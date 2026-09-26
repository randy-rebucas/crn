import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { paymentScopeWhere, refundScopeWhere } from '../../common/authz/scope.js';
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

  // Scoped by `refunds.view` (blueprint Section 8: branch-specific
  // financial visibility) — a Finance Officer only sees their own branch's
  // refunds, never the whole organization's.
  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.refund.findMany({
      where: { organizationId: user.organizationId, ...refundScopeWhere(user, 'refunds.view') },
      include: {
        payment: {
          select: {
            amount: true,
            method: true,
            receipt: { select: { receiptNumber: true } },
            invoice: {
              select: {
                enrollment: {
                  select: { student: { select: { user: { select: { firstName: true, lastName: true } } } } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id, organizationId: user.organizationId, ...refundScopeWhere(user, 'refunds.view') },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  async create(user: AuthenticatedUser, actorId: string, dto: CreateRefundDto) {
    const organizationId = user.organizationId;
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: dto.paymentId,
        invoice: { organizationId },
        status: PaymentStatus.VERIFIED,
        ...paymentScopeWhere(user, 'refunds.create'),
      },
    });
    if (!payment) throw new NotFoundException('Verified payment not found');
    // Every refund still in play (anything not rejected) counts against the
    // payment, so several requests can't add up to more than was paid.
    const alreadyRefunded = await this.prisma.refund.aggregate({
      where: { paymentId: dto.paymentId, status: { not: RefundStatus.REJECTED } },
      _sum: { amount: true },
    });
    const refundable = payment.amount - (alreadyRefunded._sum.amount ?? 0);
    if (dto.amount > refundable) {
      throw new BadRequestException(
        refundable > 0
          ? `Only ${(refundable / 100).toFixed(2)} of this payment is left to refund`
          : 'This payment has already been fully refunded or has refunds pending for its full amount',
      );
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

  // Scope-checks the lookup against `scopePermissionKey` (the permission
  // actually gating this transition) rather than reusing `refunds.view`'s
  // scope — a custom role could hold `refunds.view` at ORGANIZATION but
  // `refunds.officer_approve` at BRANCH, and the narrower one must govern
  // which refunds this specific action can reach.
  private async transition(
    user: AuthenticatedUser,
    id: string,
    nextStatus: RefundStatus,
    scopePermissionKey: string,
  ) {
    const organizationId = user.organizationId;
    const actorId = user.id;
    const refund = await this.prisma.refund.findFirst({
      where: { id, organizationId, ...refundScopeWhere(user, scopePermissionKey) },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    const allowed = ALLOWED_TRANSITIONS[refund.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move refund from ${refund.status} to ${nextStatus}`);
    }

    // Separation of duties per refund, not just per role: someone holding an
    // officer role and a manager role must not push one refund through both
    // approvals alone. The audit log is the record of who officer-approved.
    if (nextStatus === RefundStatus.APPROVED) {
      const officerApproval = await this.prisma.auditLog.findFirst({
        where: { organizationId, resource: 'refund', resourceId: id, action: 'refund.officer_approved' },
        orderBy: { createdAt: 'desc' },
        select: { actorId: true },
      });
      if (officerApproval?.actorId === actorId) {
        throw new ForbiddenException('The manager approval must come from someone other than the officer who approved it');
      }
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

  officerApprove(user: AuthenticatedUser, id: string) {
    return this.transition(user, id, RefundStatus.OFFICER_APPROVED, 'refunds.officer_approve');
  }

  managerApprove(user: AuthenticatedUser, id: string) {
    return this.transition(user, id, RefundStatus.APPROVED, 'refunds.manager_approve');
  }

  async reject(user: AuthenticatedUser, id: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id, organizationId: user.organizationId, ...refundScopeWhere(user, 'refunds.view') },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    const requiredPermission =
      refund.status === RefundStatus.REQUESTED ? 'refunds.officer_approve' : 'refunds.manager_approve';
    const held = user.permissions.some((p) => p.key === requiredPermission);
    if (!held) {
      throw new ForbiddenException(`Rejecting a refund at this stage requires ${requiredPermission}`);
    }
    return this.transition(user, id, RefundStatus.REJECTED, requiredPermission);
  }

  process(user: AuthenticatedUser, id: string) {
    return this.transition(user, id, RefundStatus.PROCESSED, 'refunds.process');
  }
}
