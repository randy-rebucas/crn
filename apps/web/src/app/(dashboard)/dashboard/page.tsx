'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api-client';
import { Card, PageHeader, StatusBadge } from '@/components/ui';
import { ProgressBar, icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

// Every widget here is backed by a real endpoint the signed-in user already
// has (or lacks) permission for — no invented trend lines, per-course
// breakdowns, or announcement feeds the API doesn't actually expose. A
// widget whose permission the user lacks simply doesn't render, same as
// the old shortcut-card behavior.

interface EnrollmentFunnelRow {
  status: string;
  count: number;
}

interface MonthlyPoint {
  month: string;
  value: number;
}

interface RevenueSummary {
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
  monthly: MonthlyPoint[];
}

interface StudentRow {
  id: string;
  createdAt: string;
}

interface CourseRow {
  id: string;
  createdAt: string;
}

interface ExamPerformanceRow {
  examId: string;
  title: string;
  attempts: number;
  averageScorePct: number | null;
  passRate: number | null;
}

interface RecentEnrollment {
  id: string;
  status: string;
  createdAt: string;
  student: { user: { firstName: string; lastName: string } };
  program: { name: string } | null;
}

interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  createdAt: string;
}

// Same red-700/slate/amber family the rest of the admin shell already
// uses — no navy/maroon/gold, per DESIGN.md's split between the public
// marketing system and this utilitarian operate surface.
const CHART_COLORS = ['#b91c1c', '#f59e0b', '#0f172a', '#64748b', '#fca5a5', '#fde68a'];

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

// Derived client-side from the same /v1/enrollments payload the "Recent
// Enrollments" table already fetches — real per-org data, not an invented
// trend line the API doesn't expose.
function buildEnrollmentTrend(enrollments: RecentEnrollment[]) {
  const byMonth = new Map<string, { active: number; other: number }>();
  for (const e of enrollments) {
    const key = monthKey(e.createdAt);
    const bucket = byMonth.get(key) ?? { active: 0, other: 0 };
    if (e.status === 'ENROLLED' || e.status === 'COMPLETED') bucket.active += 1;
    else bucket.other += 1;
    byMonth.set(key, bucket);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-9)
    .map(([key, counts]) => ({ month: monthLabel(key), ...counts }));
}

// Same shape as the API's own bucketByMonth (reports.service.ts) — zero-
// filled last N calendar months, oldest first — but run client-side over
// rows the dashboard already fetched for its own purposes (students,
// courses), so it doesn't need a dedicated endpoint for those two.
function buildMonthlyCounts(items: { createdAt: string }[], months = 6): MonthlyPoint[] {
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
  for (const item of items) {
    const key = monthKey(item.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return keys.map((key) => ({ month: monthLabel(key), value: buckets.get(key) ?? 0 }));
}

function monthOverMonthChange(points: MonthlyPoint[]): number | null {
  if (points.length < 2) return null;
  const prev = points[points.length - 2].value;
  const last = points[points.length - 1].value;
  if (prev === 0) return last === 0 ? 0 : null;
  return Math.round(((last - prev) / prev) * 100);
}

function buildEnrollmentByProgram(enrollments: RecentEnrollment[]) {
  const byProgram = new Map<string, number>();
  for (const e of enrollments) {
    const name = e.program?.name ?? 'Unassigned';
    byProgram.set(name, (byProgram.get(name) ?? 0) + 1);
  }
  return Array.from(byProgram.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name, count], i) => ({ name, count, color: CHART_COLORS[i % CHART_COLORS.length] }));
}

function pesos(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pesosCompact(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STAT_TONES = {
  red: { bg: 'bg-red-50 text-red-700', line: '#dc2626' },
  amber: { bg: 'bg-amber-50 text-amber-600', line: '#d97706' },
} as const;

function Sparkline({ data, color }: { data: MonthlyPoint[]; color: string }) {
  return (
    <div className="h-8 w-14 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  isError,
  tone = 'red',
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  isError?: boolean;
  tone?: keyof typeof STAT_TONES;
  trend?: MonthlyPoint[];
}) {
  const delta = trend ? monthOverMonthChange(trend) : null;
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${STAT_TONES[tone].bg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-lg font-semibold sm:text-xl ${isError ? 'text-red-600' : 'text-slate-900'}`}>
          {isError ? 'Error' : value}
        </div>
        <div className="text-xs text-slate-500">{label}</div>
        {delta !== null && !isError && (
          <div className={`mt-0.5 text-[11px] font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% from last month
          </div>
        )}
      </div>
      {trend && trend.length > 1 && !isError && <Sparkline data={trend} color={STAT_TONES[tone].line} />}
    </Card>
  );
}

function QueryError() {
  return <p className="text-sm text-red-600">Couldn&apos;t load this data. Try refreshing the page.</p>;
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function EnrollmentTrendChart({ data }: { data: { month: string; active: number; other: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="active" name="Active" stackId="a" fill="#b91c1c" radius={[0, 0, 0, 0]} />
        <Bar dataKey="other" name="Other" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EnrollmentByProgramChart({ data, total }: { data: { name: string; count: number; color: string }[]; total: number }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold text-slate-900">{total}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Students</div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate">{row.name}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-900">
              {total > 0 ? Math.round((row.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SHORTCUTS: { label: string; href: string; permission: string; icon: React.ReactNode }[] = [
  { label: 'Students', href: '/students', permission: 'students.view', icon: adminIcons.users },
  { label: 'Enrollments', href: '/enrollments', permission: 'enrollments.view', icon: adminIcons.userPlus },
  { label: 'Admissions', href: '/admissions', permission: 'admissions.view', icon: adminIcons.clipboardCheck },
  { label: 'Reports', href: '/reports', permission: 'reports.view', icon: adminIcons.pieChart },
];

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();

  const canReports = hasPermission('reports.view');
  const canStudents = hasPermission('students.view');
  const canCourses = hasPermission('courses.view');
  const canEnrollments = hasPermission('enrollments.view');
  const canAudit = hasPermission('audit_logs.view');

  const studentsQuery = useQuery<StudentRow[]>({
    queryKey: ['dashboard', 'students'],
    queryFn: async () => (await apiClient.get('/v1/students')).data,
    enabled: canStudents,
  });
  const coursesQuery = useQuery<CourseRow[]>({
    queryKey: ['dashboard', 'courses'],
    queryFn: async () => (await apiClient.get('/v1/courses')).data,
    enabled: canCourses,
  });
  const attemptsTrendQuery = useQuery<MonthlyPoint[]>({
    queryKey: ['dashboard', 'attempts-trend'],
    queryFn: async () => (await apiClient.get('/v1/reports/attempts-trend')).data,
    enabled: canReports,
  });
  const funnelQuery = useQuery<EnrollmentFunnelRow[]>({
    queryKey: ['dashboard', 'enrollment-funnel'],
    queryFn: async () => (await apiClient.get('/v1/reports/enrollment-funnel')).data,
    enabled: canReports,
  });
  const revenueQuery = useQuery<RevenueSummary>({
    queryKey: ['dashboard', 'revenue'],
    queryFn: async () => (await apiClient.get('/v1/reports/revenue')).data,
    enabled: canReports,
  });
  const examPerfQuery = useQuery<ExamPerformanceRow[]>({
    queryKey: ['dashboard', 'exam-performance'],
    queryFn: async () => (await apiClient.get('/v1/reports/exam-performance')).data,
    enabled: canReports,
  });
  const recentEnrollmentsQuery = useQuery<RecentEnrollment[]>({
    queryKey: ['dashboard', 'recent-enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
    enabled: canEnrollments,
  });
  const activityQuery = useQuery<AuditLogEntry[]>({
    queryKey: ['dashboard', 'activity'],
    queryFn: async () => (await apiClient.get('/v1/audit-logs')).data,
    enabled: canAudit,
  });

  const totalExamAttempts = examPerfQuery.data?.reduce((sum, row) => sum + row.attempts, 0);
  const visibleShortcuts = SHORTCUTS.filter((s) => hasPermission(s.permission));
  const funnelTotal = funnelQuery.data?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const topExams = examPerfQuery.data
    ?.slice()
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);
  const recentEnrollments = recentEnrollmentsQuery.data?.slice(0, 5);
  const recentActivity = activityQuery.data?.slice(0, 8);
  const enrollmentTrend = useMemo(
    () => (recentEnrollmentsQuery.data ? buildEnrollmentTrend(recentEnrollmentsQuery.data) : []),
    [recentEnrollmentsQuery.data],
  );
  const enrollmentByProgram = useMemo(
    () => (recentEnrollmentsQuery.data ? buildEnrollmentByProgram(recentEnrollmentsQuery.data) : []),
    [recentEnrollmentsQuery.data],
  );
  const enrollmentByProgramTotal = enrollmentByProgram.reduce((sum, row) => sum + row.count, 0);
  const studentsTrend = useMemo(
    () => (studentsQuery.data ? buildMonthlyCounts(studentsQuery.data) : []),
    [studentsQuery.data],
  );
  const coursesTrend = useMemo(
    () => (coursesQuery.data ? buildMonthlyCounts(coursesQuery.data) : []),
    [coursesQuery.data],
  );

  const hasAnyWidget = canReports || canStudents || canCourses || canEnrollments || canAudit || visibleShortcuts.length > 0;

  const today = new Date();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={`Welcome back, ${user?.email ?? ''}!`}
          description="Here's what's happening with your review platform today."
        />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-right shadow-sm">
          <span className="text-slate-400">{adminIcons.schedule}</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">
              {today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="text-xs text-slate-400">{today.toLocaleDateString('en-US', { weekday: 'long' })}</div>
          </div>
        </div>
      </div>

      {!hasAnyWidget && (
        <p className="text-sm text-slate-500">Your account has no dashboard sections enabled yet.</p>
      )}

      {(canStudents || canCourses || canReports) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canStudents && (
            <StatCard
              icon={adminIcons.users}
              label="Total Students"
              value={studentsQuery.data?.length ?? '—'}
              isError={studentsQuery.isError}
              tone="red"
              trend={studentsTrend}
            />
          )}
          {canCourses && (
            <StatCard
              icon={baseIcons.learn}
              label="Active Courses"
              value={coursesQuery.data?.length ?? '—'}
              isError={coursesQuery.isError}
              tone="amber"
              trend={coursesTrend}
            />
          )}
          {canReports && (
            <StatCard
              icon={adminIcons.exams}
              label="Graded Exam Attempts"
              value={totalExamAttempts ?? '—'}
              isError={examPerfQuery.isError || attemptsTrendQuery.isError}
              tone="red"
              trend={attemptsTrendQuery.data}
            />
          )}
          {canReports && (
            <StatCard
              icon={adminIcons.creditCard}
              label="Revenue Collected"
              value={revenueQuery.data ? pesosCompact(revenueQuery.data.totalCollected) : '—'}
              isError={revenueQuery.isError}
              tone="amber"
              trend={revenueQuery.data?.monthly}
            />
          )}
        </div>
      )}

      {canEnrollments && (
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionCard title="Student Enrollment Trend">
              {recentEnrollmentsQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
              {recentEnrollmentsQuery.isError && <QueryError />}
              {enrollmentTrend.length === 0 && recentEnrollmentsQuery.data && (
                <p className="text-sm text-slate-500">No enrollments recorded yet.</p>
              )}
              {enrollmentTrend.length > 0 && <EnrollmentTrendChart data={enrollmentTrend} />}
            </SectionCard>
          </div>
          <SectionCard title="Enrollment by Program">
            {recentEnrollmentsQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {recentEnrollmentsQuery.isError && <QueryError />}
            {enrollmentByProgram.length === 0 && recentEnrollmentsQuery.data && (
              <p className="text-sm text-slate-500">No enrollments recorded yet.</p>
            )}
            {enrollmentByProgram.length > 0 && (
              <EnrollmentByProgramChart data={enrollmentByProgram} total={enrollmentByProgramTotal} />
            )}
          </SectionCard>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canReports && (
            <SectionCard title="Enrollment Funnel" action={<Link href="/reports" className="text-xs font-medium text-red-700 hover:underline">View reports</Link>}>
              {funnelQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
              {funnelQuery.isError && <QueryError />}
              {funnelQuery.data && funnelQuery.data.length === 0 && (
                <p className="text-sm text-slate-500">No enrollments recorded yet.</p>
              )}
              {funnelQuery.data && funnelQuery.data.length > 0 && (
                <div className="space-y-3">
                  {funnelQuery.data.map((row) => (
                    <div key={row.status}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <StatusBadge status={row.status} />
                        <span className="font-medium text-slate-600">{row.count}</span>
                      </div>
                      <ProgressBar value={row.count} max={funnelTotal} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {canEnrollments && (
            <SectionCard title="Recent Enrollments" action={<Link href="/enrollments" className="text-xs font-medium text-red-700 hover:underline">View all</Link>}>
              {recentEnrollmentsQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
              {recentEnrollmentsQuery.isError && <QueryError />}
              {recentEnrollments && recentEnrollments.length === 0 && (
                <p className="text-sm text-slate-500">No enrollments yet.</p>
              )}
              {recentEnrollments && recentEnrollments.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2 font-medium">Student</th>
                        <th className="pb-2 font-medium">Program</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEnrollments.map((e) => (
                        <tr key={e.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 text-slate-700">
                            {e.student.user.firstName} {e.student.user.lastName}
                          </td>
                          <td className="py-2 text-slate-500">{e.program?.name ?? '—'}</td>
                          <td className="py-2 text-slate-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                          <td className="py-2">
                            <StatusBadge status={e.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {canReports && (
            <SectionCard title="Top Exams by Attempts">
              {examPerfQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
              {examPerfQuery.isError && <QueryError />}
              {topExams && topExams.length === 0 && <p className="text-sm text-slate-500">No graded attempts yet.</p>}
              {topExams && topExams.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-2 font-medium">Exam</th>
                        <th className="pb-2 font-medium">Attempts</th>
                        <th className="pb-2 font-medium">Avg. Score</th>
                        <th className="pb-2 font-medium">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topExams.map((row) => (
                        <tr key={row.examId} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 text-slate-700">{row.title}</td>
                          <td className="py-2 text-slate-500">{row.attempts}</td>
                          <td className="py-2 text-slate-500">{row.averageScorePct ?? '—'}%</td>
                          <td className="py-2 w-40">
                            {row.passRate === null ? '—' : <ProgressBar value={row.passRate} max={100} tone="green" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          {visibleShortcuts.length > 0 && (
            <SectionCard title="Quick Actions">
              <div className="grid grid-cols-2 gap-3">
                {visibleShortcuts.map((s, i) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={`flex flex-col items-center gap-2 rounded-lg p-3 text-center text-xs font-medium transition hover:brightness-95 ${
                      i % 2 === 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span>{s.icon}</span>
                    {s.label}
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}

          {canReports && (
            <SectionCard title="Revenue Summary">
              {revenueQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
              {revenueQuery.isError && <QueryError />}
              {revenueQuery.data && revenueQuery.data.totalInvoiced === 0 && (
                <p className="text-sm text-slate-500">No invoices recorded yet.</p>
              )}
              {revenueQuery.data && revenueQuery.data.totalInvoiced > 0 && (
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Invoiced</dt>
                    <dd className="font-medium text-slate-900">{pesos(revenueQuery.data.totalInvoiced)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Collected</dt>
                    <dd className="font-medium text-emerald-700">{pesos(revenueQuery.data.totalCollected)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Outstanding</dt>
                    <dd className="font-medium text-red-700">{pesos(revenueQuery.data.outstanding)}</dd>
                  </div>
                </dl>
              )}
            </SectionCard>
          )}

          {canAudit && (
            <SectionCard title="Activity Log" action={<Link href="/audit-logs" className="text-xs font-medium text-red-700 hover:underline">View all</Link>}>
              {activityQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
              {activityQuery.isError && <QueryError />}
              {recentActivity && recentActivity.length === 0 && (
                <p className="text-sm text-slate-500">No activity recorded yet.</p>
              )}
              {recentActivity && recentActivity.length > 0 && (
                <ul className="space-y-3">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">
                          <span className="font-medium">{entry.resource}</span> · {entry.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-400">{timeAgo(entry.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
