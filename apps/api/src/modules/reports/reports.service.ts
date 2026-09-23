import { Injectable } from '@nestjs/common';
import { AttemptStatus, AttendanceStatus, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

// Reports are a read layer over the core tables (blueprint Section 34) —
// no dedicated reporting schema yet, just scoped aggregate queries. Every
// query is organizationId-scoped the same way every other module is.
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Shared by revenueSummary's `monthly` field and attemptsTrend: buckets a
  // set of dated rows into the last N calendar months (oldest first), zero-
  // filling months with no activity so dashboard sparklines get a stable
  // number of points instead of skipping gaps in the data. `value` lets the
  // caller sum an amount (revenue) instead of just counting rows (attempts).
  private bucketByMonth(rows: { date: Date; value?: number }[], months: number) {
    const buckets = new Map<string, number>();
    const cursor = new Date();
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      keys.push(key);
      buckets.set(key, 0);
    }
    for (const row of rows) {
      const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (row.value ?? 1));
    }
    return keys.map((key) => ({
      month: new Date(`${key}-01`).toLocaleDateString('en-US', { month: 'short' }),
      value: buckets.get(key) ?? 0,
    }));
  }

  async enrollmentFunnel(organizationId: string) {
    const grouped = await this.prisma.enrollment.groupBy({
      by: ['status'],
      where: { student: { organizationId } },
      _count: { _all: true },
    });

    return grouped.map((row) => ({ status: row.status, count: row._count._all }));
  }

  async revenueSummary(organizationId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [invoiceTotals, verifiedPayments, byBranch, recentPayments] = await Promise.all([
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
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.VERIFIED, invoice: { organizationId }, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, amount: true },
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
      monthly: this.bucketByMonth(
        recentPayments.map((p) => ({ date: p.createdAt, value: p.amount })),
        6,
      ),
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

  // Organization-wide graded-attempt volume by month, for the dashboard's
  // "Graded Exam Attempts" sparkline — distinct from examPerformance, which
  // is per-exam and has no time dimension.
  async attemptsTrend(organizationId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const attempts = await this.prisma.attempt.findMany({
      where: {
        status: AttemptStatus.GRADED,
        exam: { organizationId },
        gradedAt: { gte: sixMonthsAgo },
      },
      select: { gradedAt: true },
    });

    return this.bucketByMonth(
      attempts.filter((a) => a.gradedAt).map((a) => ({ date: a.gradedAt as Date })),
      6,
    );
  }
}
