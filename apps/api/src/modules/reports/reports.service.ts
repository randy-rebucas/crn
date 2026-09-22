import { Injectable } from '@nestjs/common';
import { AttemptStatus, AttendanceStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

// Reports are a read layer over the core tables (blueprint Section 34) —
// no dedicated reporting schema yet, just scoped aggregate queries. Every
// query is organizationId-scoped the same way every other module is.
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async enrollmentFunnel(organizationId: string) {
    const grouped = await this.prisma.enrollment.groupBy({
      by: ['status'],
      where: { student: { organizationId } },
      _count: { _all: true },
    });

    return grouped.map((row) => ({ status: row.status, count: row._count._all }));
  }

  async revenueSummary(organizationId: string) {
    const [invoiceTotals, verifiedPayments, byBranch] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId, status: { not: InvoiceStatus.CANCELLED } },
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.VERIFIED, invoice: { organizationId } },
        _sum: { amount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['branchId'],
        where: { organizationId, status: { not: InvoiceStatus.CANCELLED } },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalInvoiced = invoiceTotals._sum.totalAmount ?? 0;
    const totalCollected = verifiedPayments._sum.amount ?? 0;

    // `groupBy` can't join a relation, so `byBranch` came back with only
    // raw branch ids — fetch names for just the branches that appear and
    // map them in, rather than pushing this join onto every UI consumer.
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: byBranch.map((row) => row.branchId) } },
      select: { id: true, name: true },
    });
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

    return {
      totalInvoiced,
      totalCollected,
      outstanding: totalInvoiced - totalCollected,
      byBranch: byBranch.map((row) => ({
        branchId: row.branchId,
        branchName: branchNameById.get(row.branchId) ?? row.branchId,
        invoiced: row._sum.totalAmount ?? 0,
      })),
    };
  }

  async attendanceSummary(organizationId: string, classId?: string) {
    const grouped = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { class: { branch: { organizationId } }, ...(classId ? { classId } : {}) },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    const present = counts[AttendanceStatus.PRESENT] ?? 0;

    return {
      counts,
      total,
      attendanceRate: total === 0 ? null : Math.round((present / total) * 1000) / 10,
    };
  }

  async examPerformance(organizationId: string) {
    const exams = await this.prisma.exam.findMany({
      where: { organizationId },
      select: { id: true, title: true, passingScore: true },
    });

    const results = await Promise.all(
      exams.map(async (exam) => {
        const graded = await this.prisma.attempt.findMany({
          where: { examId: exam.id, status: AttemptStatus.GRADED },
          select: { score: true, maxScore: true, passed: true },
        });

        if (graded.length === 0) {
          return { examId: exam.id, title: exam.title, attempts: 0, averageScorePct: null, passRate: null };
        }

        const averagePct =
          graded.reduce((sum, a) => sum + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) /
          graded.length;
        const passRate = graded.filter((a) => a.passed).length / graded.length;

        return {
          examId: exam.id,
          title: exam.title,
          attempts: graded.length,
          averageScorePct: Math.round(averagePct * 1000) / 10,
          passRate: Math.round(passRate * 1000) / 10,
        };
      }),
    );

    return results;
  }
}
