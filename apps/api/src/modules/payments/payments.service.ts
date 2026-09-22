import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';

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
  // still narrows to one invoice's payments when provided.
  findAllForInvoice(organizationId: string, invoiceId?: string) {
    return this.prisma.payment.findMany({
      where: {
        invoice: { organizationId },
        ...(invoiceId ? { invoiceId } : {}),
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
      take: invoiceId ? undefined : 200,
    });
  }

  async create(organizationId: string, actorId: string, dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, organizationId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Invoice is already ${invoice.status.toLowerCase()}`);
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

  async verify(organizationId: string, actorId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, invoice: { organizationId } },
      include: { invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already ${payment.status.toLowerCase()}`);
    }

    const alreadyVerified = await this.prisma.payment.aggregate({
      where: { invoiceId: payment.invoiceId, status: PaymentStatus.VERIFIED },
      _sum: { amount: true },
    });
    const verifiedSoFar = alreadyVerified._sum.amount ?? 0;
    if (verifiedSoFar + payment.amount > payment.invoice.totalAmount) {
      throw new BadRequestException('Verifying this payment would exceed the invoice total');
    }

    const [verified, receipt] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id },
        data: { status: PaymentStatus.VERIFIED, verifiedById: actorId, verifiedAt: new Date() },
      }),
      this.prisma.receipt.create({
        data: { paymentId: id, receiptNumber: `RCPT-${id.slice(0, 8).toUpperCase()}` },
      }),
    ]);

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
    if (enrollment) {
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

  async reject(organizationId: string, actorId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, invoice: { organizationId } } });
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
