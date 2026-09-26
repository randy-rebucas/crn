import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SAFE_USER_SELECT } from '../../common/prisma/safe-selects.js';
import { enrollmentScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { ENROLLMENT_TRANSITIONS } from './enrollment-transitions.js';
import { readOrgSettings } from '../settings/org-settings.js';

const STUDENT_INCLUDE = { student: { select: { id: true, user: { select: SAFE_USER_SELECT } } } };

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // Scoped by `enrollments.view` (blueprint Section 7): a Branch Manager
  // only sees enrollments in their own branch(es).
  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.enrollment.findMany({
      where: {
        student: { organizationId: user.organizationId },
        ...enrollmentScopeWhere(user, 'enrollments.view'),
      },
      include: { ...STUDENT_INCLUDE, program: true, batch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id,
        student: { organizationId: user.organizationId },
        ...enrollmentScopeWhere(user, 'enrollments.view'),
      },
      include: { ...STUDENT_INCLUDE, program: true, batch: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return enrollment;
  }

  async create(organizationId: string, actorId: string, dto: CreateEnrollmentDto) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const program = await this.prisma.program.findFirst({
      where: { id: dto.programId, organizationId },
    });
    if (!program) throw new NotFoundException('Program not found');

    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId: dto.studentId,
        programId: dto.programId,
        batchId: dto.batchId,
        branchId: dto.branchId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'enrollment.created',
      resource: 'enrollment',
      resourceId: enrollment.id,
      afterState: enrollment,
    });

    return enrollment;
  }

  async transition(user: AuthenticatedUser, id: string, nextStatus: EnrollmentStatus) {
    const organizationId = user.organizationId;
    const actorId = user.id;
    const enrollment = await this.findOne(user, id);

    const allowed = ENROLLMENT_TRANSITIONS[enrollment.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot move enrollment from ${enrollment.status} to ${nextStatus}`,
      );
    }

    // "Payment verified" must reflect money a cashier actually verified in
    // Finance — otherwise enrollments.update alone would bypass payments.verify.
    if (nextStatus === EnrollmentStatus.PAYMENT_VERIFIED) {
      const verifiedPayments = await this.prisma.payment.count({
        where: {
          status: PaymentStatus.VERIFIED,
          invoice: { enrollmentId: id, status: { not: InvoiceStatus.CANCELLED } },
        },
      });
      if (verifiedPayments === 0) {
        throw new BadRequestException(
          'This enrollment has no verified payment yet. Record the payment in Finance and have it verified first.',
        );
      }
    }

    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: { status: nextStatus },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'enrollment.status_changed',
      resource: 'enrollment',
      resourceId: id,
      beforeState: { status: enrollment.status },
      afterState: { status: updated.status },
    });

    const notify =
      (nextStatus === EnrollmentStatus.ENROLLED || nextStatus === EnrollmentStatus.APPROVED) &&
      (await readOrgSettings(this.prisma, organizationId)).notifyOnEnrollment;
    if (notify) {
      await this.notifications.emit({
        organizationId,
        userId: enrollment.student.user.id,
        type: `enrollment.${nextStatus.toLowerCase()}`,
        title:
          nextStatus === EnrollmentStatus.ENROLLED
            ? 'Enrollment confirmed'
            : 'Your enrollment has been approved',
        body:
          nextStatus === EnrollmentStatus.ENROLLED
            ? 'You are now enrolled and have learning access.'
            : 'Your application was approved. Complete payment to finish enrolling.',
      });
    }

    return updated;
  }
}
