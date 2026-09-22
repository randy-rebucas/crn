'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';

interface EnrollmentFunnelRow {
  status: string;
  count: number;
}

interface RevenueSummary {
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
  byBranch: { branchId: string; branchName: string; invoiced: number }[];
}

interface AttendanceSummary {
  counts: Record<string, number>;
  total: number;
  attendanceRate: number | null;
}

interface ExamPerformanceRow {
  examId: string;
  title: string;
  attempts: number;
  averageScorePct: number | null;
  passRate: number | null;
}

function money(value: number) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'PHP' });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

function ReportSection({
  title,
  isLoading,
  isError,
  errorMessage,
  isEmpty,
  emptyDescription,
  children,
}: {
  title: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  isEmpty?: boolean;
  emptyDescription?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {isLoading && <LoadingState />}
      {isError && <ErrorState message={errorMessage} />}
      {!isLoading && !isError && isEmpty && (
        <EmptyState title="No data" description={emptyDescription ?? 'Nothing to show yet.'} />
      )}
      {!isLoading && !isError && !isEmpty && children}
    </section>
  );
}

function EnrollmentFunnelSection() {
  const { data, isLoading, isError } = useQuery<EnrollmentFunnelRow[]>({
    queryKey: ['reports', 'enrollment-funnel'],
    queryFn: async () => (await apiClient.get('/v1/reports/enrollment-funnel')).data,
  });

  return (
    <ReportSection
      title="Enrollment funnel"
      isLoading={isLoading}
      isError={isError}
      errorMessage="Could not load the enrollment funnel report."
      isEmpty={data?.length === 0}
    >
      <div className="flex flex-wrap gap-3">
        {data?.map((row) => (
          <StatCard key={row.status} label={row.status.replace(/_/g, ' ')} value={String(row.count)} />
        ))}
      </div>
    </ReportSection>
  );
}

function RevenueSection() {
  const { data, isLoading, isError } = useQuery<RevenueSummary>({
    queryKey: ['reports', 'revenue'],
    queryFn: async () => (await apiClient.get('/v1/reports/revenue')).data,
  });

  return (
    <ReportSection
      title="Revenue"
      isLoading={isLoading}
      isError={isError}
      errorMessage="Could not load the revenue report."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <StatCard label="Total invoiced" value={money(data?.totalInvoiced ?? 0)} />
        <StatCard label="Total collected" value={money(data?.totalCollected ?? 0)} />
        <StatCard label="Outstanding" value={money(data?.outstanding ?? 0)} />
      </div>
      {data && data.byBranch.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Invoiced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byBranch.map((row) => (
                <tr key={row.branchId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.branchName}</td>
                  <td className="px-4 py-3 text-slate-600">{money(row.invoiced)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </ReportSection>
  );
}

function AttendanceSection() {
  const { data, isLoading, isError } = useQuery<AttendanceSummary>({
    queryKey: ['reports', 'attendance'],
    queryFn: async () => (await apiClient.get('/v1/reports/attendance')).data,
  });

  return (
    <ReportSection
      title="Attendance"
      isLoading={isLoading}
      isError={isError}
      errorMessage="Could not load the attendance report."
      isEmpty={data?.total === 0}
      emptyDescription="No attendance records yet."
    >
      <div className="flex flex-wrap gap-3">
        <StatCard label="Total records" value={String(data?.total ?? 0)} />
        <StatCard
          label="Attendance rate"
          value={data?.attendanceRate === null || data?.attendanceRate === undefined ? '—' : `${data.attendanceRate}%`}
        />
        {data &&
          Object.entries(data.counts).map(([status, count]) => (
            <StatCard key={status} label={status.replace(/_/g, ' ')} value={String(count)} />
          ))}
      </div>
    </ReportSection>
  );
}

function ExamPerformanceSection() {
  const { data, isLoading, isError } = useQuery<ExamPerformanceRow[]>({
    queryKey: ['reports', 'exam-performance'],
    queryFn: async () => (await apiClient.get('/v1/reports/exam-performance')).data,
  });

  return (
    <ReportSection
      title="Exam performance"
      isLoading={isLoading}
      isError={isError}
      errorMessage="Could not load the exam performance report."
      isEmpty={data?.length === 0}
      emptyDescription="No exams found."
    >
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">Graded attempts</th>
              <th className="px-4 py-3">Average score</th>
              <th className="px-4 py-3">Pass rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((row) => (
              <tr key={row.examId}>
                <td className="px-4 py-3 font-medium text-slate-900">{row.title}</td>
                <td className="px-4 py-3 text-slate-600">{row.attempts}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.averageScorePct === null ? '—' : `${row.averageScorePct}%`}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.passRate === null ? '—' : `${row.passRate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </ReportSection>
  );
}

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Aggregate views over enrollment, revenue, attendance and exams." />
      <EnrollmentFunnelSection />
      <RevenueSection />
      <AttendanceSection />
      <ExamPerformanceSection />
    </div>
  );
}
