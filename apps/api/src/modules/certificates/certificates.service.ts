import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { certificateScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { IssueCertificateDto } from './dto/issue-certificate.dto.js';
import { readOrgSettings } from '../settings/org-settings.js';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.certificate.findMany({
      where: { organizationId: user.organizationId, ...certificateScopeWhere(user, 'certificates.view') },
      include: { program: { select: { name: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // Public verification: no auth, deliberately returns only what a
  // third party (employer, licensing board) needs to trust the
  // certificate — never internal ids, contact info, or financial data.
  async verify(qrToken: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { qrToken },
      include: {
        student: { select: { user: { select: { firstName: true, lastName: true } } } },
        program: { select: { name: true } },
      },
    });
    if (!certificate) throw new NotFoundException('Certificate not found');

    return {
      certificateNumber: certificate.certificateNumber,
      studentName: `${certificate.student.user.firstName} ${certificate.student.user.lastName}`,
      programName: certificate.program.name,
      issuedAt: certificate.issuedAt,
      valid: true,
    };
  }

  async issue(organizationId: string, actorId: string, dto: IssueCertificateDto) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, organizationId },
      select: { userId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const completedEnrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: dto.studentId, programId: dto.programId, status: EnrollmentStatus.COMPLETED },
    });
    if (!completedEnrollment) {
      throw new BadRequestException('Student has no completed enrollment for this program');
    }

    const existing = await this.prisma.certificate.findFirst({
      where: { studentId: dto.studentId, programId: dto.programId },
    });
    if (existing) throw new BadRequestException('A certificate has already been issued for this completion');

    const settings = await readOrgSettings(this.prisma, organizationId);

    const certificate = await this.prisma.certificate.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        programId: dto.programId,
        certificateNumber: `${settings.certificatePrefix}-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        qrToken: randomBytes(16).toString('hex'),
        issuedById: actorId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'certificate.issued',
      resource: 'certificate',
      resourceId: certificate.id,
      afterState: certificate,
    });

    if (settings.notifyOnCertificateIssued) {
      await this.notifications.emit({
        organizationId,
        userId: student.userId,
        type: 'certificate.issued',
        title: 'Certificate issued',
        body: `Your certificate ${certificate.certificateNumber} is ready.`,
      });
    }

    return certificate;
  }
}
