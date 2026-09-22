'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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

interface RevenueSummary {
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
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

function pesos(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xl font-semibold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Card>
  );
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

  const studentsQuery = useQuery<unknown[]>({
    queryKey: ['dashboard', 'students'],
    queryFn: async () => (await apiClient.get('/v1/students')).data,
    enabled: canStudents,
  });
  const coursesQuery = useQuery<unknown[]>({
    queryKey: ['dashboard', 'courses'],
    queryFn: async () => (await apiClient.get('/v1/courses')).data,
    enabled: canCourses,
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

  const hasAnyWidget = canReports || canStudents || canCourses || canEnrollments || canAudit || visibleShortcuts.length > 0;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.email ?? ''}`}
        description={new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {!hasAnyWidget && (
        <p className="text-sm text-slate-500">Your account has no dashboard sections enabled yet.</p>
      )}

      {(canStudents || canCourses || canReports) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canStudents && (
            <StatCard icon={adminIcons.users} label="Total Students" value={studentsQuery.data?.length ?? '—'} />
          )}
          {canCourses && (
            <StatCard icon={baseIcons.learn} label="Active Courses" value={coursesQuery.data?.length ?? '—'} />
          )}
          {canReports && (
            <StatCard icon={adminIcons.exams} label="Graded Exam Attempts" value={totalExamAttempts ?? '—'} />
          )}
          {canReports && (
            <StatCard
              icon={adminIcons.creditCard}
              label="Revenue Collected"
              value={revenueQuery.data ? pesos(revenueQuery.data.totalCollected) : '—'}
            />
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canReports && (
            <SectionCard title="Enrollment Funnel" action={<Link href="/reports" className="text-xs font-medium text-red-700 hover:underline">View reports</Link>}>
              {funnelQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
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
                {visibleShortcuts.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-3 text-center text-xs font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    <span>{s.icon}</span>
                    {s.label}
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}

          {canReports && revenueQuery.data && (
            <SectionCard title="Revenue Summary">
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
            </SectionCard>
          )}

          {canAudit && (
            <SectionCard title="Activity Log" action={<Link href="/audit-logs" className="text-xs font-medium text-red-700 hover:underline">View all</Link>}>
              {activityQuery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
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
