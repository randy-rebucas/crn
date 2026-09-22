import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateRefundDto } from './dto/create-refund.dto.js';

// Refund approval chain (blueprint Section 25):
// Requested -> Finance Officer approval -> Finance Manager approval -> Processed.
const ALLOWED_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  REQUESTED: [RefundStatus.OFFICER_APPROVED, RefundStatus.REJECTED],
  OFFICER_APPROVED: [RefundStatus.APPROVED, RefundStatus.REJECTED],
  APPROVED: [RefundStatus.PROCESSED],
  PROCESSED: [],
  REJECTED: [],
};

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.refund.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const refund = await this.prisma.refund.findFirst({ where: { id, organizationId } });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  async create(organizationId: string, actorId: string, dto: CreateRefundDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, invoice: { organizationId }, status: PaymentStatus.VERIFIED },
    });
    if (!payment) throw new NotFoundException('Verified payment not found');
    if (dto.amount > payment.amount) {
      throw new BadRequestException('Refund amount cannot exceed the original payment amount');
    }

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: dto.paymentId,
        organizationId,
        amount: dto.amount,
        reason: dto.reason,
        requestedById: actorId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'refund.requested',
      resource: 'refund',
      resourceId: refund.id,
      afterState: refund,
    });

    return refund;
  }

  private async transition(
    organizationId: string,
    actorId: string,
    id: string,
    nextStatus: RefundStatus,
  ) {
    const refund = await this.findOne(organizationId, id);

    const allowed = ALLOWED_TRANSITIONS[refund.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move refund from ${refund.status} to ${nextStatus}`);
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: {
        status: nextStatus,
        approvedById: nextStatus === RefundStatus.APPROVED ? actorId : refund.approvedById,
        processedAt: nextStatus === RefundStatus.PROCESSED ? new Date() : refund.processedAt,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: `refund.${nextStatus.toLowerCase()}`,
      resource: 'refund',
      resourceId: id,
      beforeState: { status: refund.status },
      afterState: { status: updated.status },
    });

    if (nextStatus === RefundStatus.PROCESSED) {
      const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: refund.paymentId } });
      await this.invoices.recomputeStatus(payment.invoiceId);
    }

    return updated;
  }

  officerApprove(organizationId: string, actorId: string, id: string) {
    return this.transition(organizationId, actorId, id, RefundStatus.OFFICER_APPROVED);
  }

  managerApprove(organizationId: string, actorId: string, id: string) {
    return this.transition(organizationId, actorId, id, RefundStatus.APPROVED);
  }

  async reject(user: AuthenticatedUser, id: string) {
    const refund = await this.findOne(user.organizationId, id);
    const requiredPermission =
      refund.status === RefundStatus.REQUESTED ? 'refunds.officer_approve' : 'refunds.manager_approve';
    const held = user.permissions.some((p) => p.key === requiredPermission);
    if (!held) {
      throw new ForbiddenException(`Rejecting a refund at this stage requires ${requiredPermission}`);
    }
    return this.transition(user.organizationId, user.id, id, RefundStatus.REJECTED);
  }

  process(organizationId: string, actorId: string, id: string) {
    return this.transition(organizationId, actorId, id, RefundStatus.PROCESSED);
  }
}
