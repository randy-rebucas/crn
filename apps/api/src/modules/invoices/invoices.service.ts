import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, RefundStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateInvoiceDto } from './dto/create-invoice.dto.js';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { payments: { include: { receipt: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(organizationId: string, actorId: string, dto: CreateInvoiceDto) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: dto.enrollmentId, student: { organizationId } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const pricing = await this.prisma.pricing.findFirst({
      where: { programId: enrollment.programId, isActive: true },
    });
    if (!pricing) throw new NotFoundException('No active pricing set for this program');

    const discountAmount = dto.discountAmount ?? 0;
    if (discountAmount > pricing.amount) {
      throw new BadRequestException('Discount cannot exceed the program price');
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        enrollmentId: dto.enrollmentId,
        organizationId,
        branchId: enrollment.branchId,
        amount: pricing.amount,
        discountAmount,
        totalAmount: pricing.amount - discountAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'invoice.created',
      resource: 'invoice',
      resourceId: invoice.id,
      afterState: invoice,
    });

    return invoice;
  }

  // Recomputes UNPAID/PARTIALLY_PAID/PAID from verified payments net of
  // processed refunds. Called whenever a payment is verified or a refund
  // is processed (blueprint Section 21). Payment itself has no REFUNDED
  // status — a verified payment stays VERIFIED even after its refund is
  // processed, so refunds must be subtracted here explicitly or a fully
  // refunded invoice would still read as PAID.
  async recomputeStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    const [verifiedPayments, processedRefunds] = await Promise.all([
      this.prisma.payment.findMany({ where: { invoiceId, status: PaymentStatus.VERIFIED } }),
      this.prisma.refund.findMany({
        where: { status: RefundStatus.PROCESSED, payment: { invoiceId } },
      }),
    ]);

    const grossPaid = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);
    const refunded = processedRefunds.reduce((sum, r) => sum + r.amount, 0);
    const netPaid = grossPaid - refunded;

    const status =
      netPaid <= 0
        ? InvoiceStatus.UNPAID
        : netPaid < invoice.totalAmount
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.PAID;

    if (status === invoice.status) return invoice;

    return this.prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
}
