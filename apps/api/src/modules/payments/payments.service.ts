import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { branchScopeWhere, paymentScopeWhere } from '../../common/authz/scope.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import { readOrgSettings } from '../settings/org-settings.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly notifications: NotificationsService,
  ) {}

  // `invoiceId` is now optional so finance staff can browse/search payments
  // org-wide (needed by the refund-request flow, which previously had no
  // way to find a payment except being handed its raw id) — `invoiceId`
  // still narrows to one invoice's payments when provided. Scoped by
  // `payments.view` (blueprint Section 8: branch-specific financial
  // visibility) — a Finance Officer only sees their own branch's payments.
  //
  // `status` narrows to one status and lifts the 200-row cap: the
  // verification queue (status=PENDING) must list every pending payment,
  // not just the ones that happen to fall inside the newest 200.
  findAllForInvoice(user: AuthenticatedUser, invoiceId?: string, status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: {
        invoice: { organizationId: user.organizationId },
        ...paymentScopeWhere(user, 'payments.view'),
        ...(invoiceId ? { invoiceId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        receipt: true,
        invoice: {
          select: {
            id: true,
            enrollment: {
              select: { student: { select: { user: { select: { firstName: true, lastName: true } } } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: invoiceId || status === PaymentStatus.PENDING ? undefined : 200,
    });
  }

  async create(user: AuthenticatedUser, actorId: string, dto: CreatePaymentDto) {
    const organizationId = user.organizationId;
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, organizationId, ...branchScopeWhere(user, 'payments.create') },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Invoice is already ${invoice.status.toLowerCase()}`);
    }

    // Same basis as the verify-time check, but counting payments still
    // waiting for verification too: two pending payments for the full
    // balance would otherwise both be accepted and one fail at verify.
    const committed = await this.prisma.payment.aggregate({
      where: { invoiceId: dto.invoiceId, status: { in: [PaymentStatus.VERIFIED, PaymentStatus.PENDING] } },
      _sum: { amount: true },
    });
    const remaining = invoice.totalAmount - (committed._sum.amount ?? 0);
    if (dto.amount > remaining) {
      throw new BadRequestException(
        remaining > 0
          ? `Only ${(remaining / 100).toFixed(2)} is left to pay once pending payments are verified`
          : 'Pending payments already cover this invoice. Verify or reject them first.',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        receivedById: actorId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'payment.recorded',
      resource: 'payment',
      resourceId: payment.id,
      afterState: payment,
    });

    return payment;
  }

  async verify(user: AuthenticatedUser, actorId: string, id: string) {
    const organizationId = user.organizationId;
    const payment = await this.prisma.payment.findFirst({
      where: { id, invoice: { organizationId }, ...paymentScopeWhere(user, 'payments.verify') },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already ${payment.status.toLowerCase()}`);
    }

    // The over-verification check and the status update must be atomic —
    // running the aggregate before a separate transaction let two
    // concurrent verify calls both read the pre-update sum, both pass the
    // check, and jointly push the invoice over its total. An interactive
    // transaction re-reads the sum inside the same transaction that writes
    // the update, closing that race.
    const settings = await readOrgSettings(this.prisma, organizationId);

    const { verified, receipt } = await this.prisma.$transaction(async (tx) => {
      const alreadyVerified = await tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId, status: PaymentStatus.VERIFIED },
        _sum: { amount: true },
      });
      const verifiedSoFar = alreadyVerified._sum.amount ?? 0;
      if (verifiedSoFar + payment.amount > payment.invoice.totalAmount) {
        throw new BadRequestException('Verifying this payment would exceed the invoice total');
      }

      const verified = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.VERIFIED, verifiedById: actorId, verifiedAt: new Date() },
      });
      const receipt = await tx.receipt.create({
        data: { paymentId: id, receiptNumber: `${settings.receiptPrefix}-${id.slice(0, 8).toUpperCase()}` },
      });
      return { verified, receipt };
    });

    await this.invoices.recomputeStatus(payment.invoiceId);

    await this.audit.log({
      organizationId,
      actorId,
      action: 'payment.verified',
      resource: 'payment',
      resourceId: id,
      afterState: { payment: verified, receipt },
    });

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: payment.invoice.enrollmentId },
      include: { student: { select: { userId: true } } },
    });
    if (enrollment && settings.notifyOnPaymentVerified) {
      await this.notifications.emit({
        organizationId,
        userId: enrollment.student.userId,
        type: 'payment.verified',
        title: 'Payment received',
        body: `Your payment of ${(payment.amount / 100).toFixed(2)} has been verified. Receipt ${receipt.receiptNumber}.`,
      });
    }

    return { ...verified, receipt };
  }

  async reject(user: AuthenticatedUser, actorId: string, id: string) {
    const organizationId = user.organizationId;
    const payment = await this.prisma.payment.findFirst({
      where: { id, invoice: { organizationId }, ...paymentScopeWhere(user, 'payments.verify') },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already ${payment.status.toLowerCase()}`);
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.REJECTED, verifiedById: actorId, verifiedAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'payment.rejected',
      resource: 'payment',
      resourceId: id,
      afterState: updated,
    });

    return updated;
  }
}
