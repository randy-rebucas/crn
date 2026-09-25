'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { Button, Card, PageHeader } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

// Every figure on this page comes straight from the /v1/reports endpoints —
// no invented comparisons. Month-over-month deltas only appear where the API
// actually returns a monthly series (revenue, graded attempts).

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
  byBranch: { branchId: string; branchName: string; invoiced: number }[];
  monthly: MonthlyPoint[];
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

// Same red-700 / amber / slate family the admin dashboard charts use.
const COLORS = {
  red: '#b91c1c',
  amber: '#f59e0b',
  ink: '#0f172a',
  slate: '#94a3b8',
  grid: '#f1f5f9',
  axis: '#64748b',
  green: '#059669',
};

const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' };

// Enrollment pipeline in the order a reviewee moves through it; terminal
// outcomes last so the funnel reads top-to-bottom.
const FUNNEL_ORDER = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REQUIREMENTS_INCOMPLETE',
  'APPROVED',
  'PAYMENT_PENDING',
  'PAYMENT_VERIFIED',
  'ENROLLED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
];
const FUNNEL_WON = new Set(['ENROLLED', 'COMPLETED']);
const FUNNEL_LOST = new Set(['CANCELLED', 'REJECTED']);

const ATTENDANCE_STATUSES: { status: string; label: string; color: string }[] = [
  { status: 'PRESENT', label: 'Present', color: COLORS.green },
  { status: 'LATE', label: 'Late', color: COLORS.amber },
  { status: 'EXCUSED', label: 'Excused', color: COLORS.slate },
  { status: 'ABSENT', label: 'Absent', color: COLORS.red },
];

// Amounts are stored in centavos (see Payment.amount in schema.prisma).
function pesos(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pesosCompact(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { notation: 'compact', maximumFractionDigits: 1 })}`;
}

function humanize(status: string) {
  const text = status.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function monthOverMonth(points: MonthlyPoint[] | undefined): number | null {
  if (!points || points.length < 2) return null;
  const prev = points[points.length - 2].value;
  const last = points[points.length - 1].value;
  if (prev === 0) return null;
  return Math.round(((last - prev) / prev) * 100);
}

function useReport<T>(key: string, path: string) {
  return useQuery<T>({
    queryKey: ['reports', key],
    queryFn: async () => (await apiClient.get(path)).data,
  });
}

// ---------------------------------------------------------------------------
// Building blocks

const printIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M7 9V4h10v5M7 17H5.5A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9h13a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    <rect x={7} y={14} width={10} height={6} rx={1} stroke="currentColor" strokeWidth={1.7} />
  </svg>
);

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" className={`h-3 w-3 ${up ? '' : 'rotate-180'}`} aria-hidden="true">
      <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function InlineError({ what }: { what: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      Couldn&apos;t load {what}. Refresh the page to try again.
    </p>
  );
}

function InlineEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

const TILE_TONES = {
  red: 'bg-red-700 text-white',
  amber: 'bg-amber-400 text-slate-900',
  ink: 'bg-slate-900 text-white',
} as const;

function KpiTile({
  icon,
  tone,
  label,
  value,
  detail,
  delta,
  isLoading,
  isError,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TILE_TONES;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  delta?: number | null;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TILE_TONES[tone]}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-1.5 h-7 w-24" />
        ) : (
          <p className={`mt-0.5 truncate text-2xl font-semibold tabular-nums ${isError ? 'text-red-600' : 'text-slate-900'}`}>
            {isError ? 'Unavailable' : value}
          </p>
        )}
        {!isLoading && !isError && (delta != null || detail) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
            {delta != null && (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                <TrendArrow up={delta >= 0} />
                {Math.abs(delta)}%
              </span>
            )}
            {detail}
          </p>
        )}
      </div>
    </Card>
  );
}

function Panel({
  icon,
  title,
  description,
  href,
  linkLabel,
  className = '',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`flex flex-col p-5 ${className}`}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 rounded text-xs font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 print:hidden"
          >
            {linkLabel ?? 'View all'}
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

function Meter({ value, color, label }: { value: number; color: string; label?: string }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuenow={label ? value : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }} />
    </div>
  );
}

function passTone(rate: number) {
  if (rate >= 75) return COLORS.green;
  if (rate >= 50) return COLORS.amber;
  return COLORS.red;
}

// ---------------------------------------------------------------------------
// Sections

function CollectionsTrendPanel({ query }: { query: ReturnType<typeof useReport<RevenueSummary>> }) {
  const data = query.data?.monthly.map((p) => ({ month: p.month, value: p.value / 100 }));
  const hasAny = data?.some((p) => p.value > 0);

  return (
    <Panel
      icon={adminIcons.creditCard}
      title="Collections, last 6 months"
      description="Verified payments received per month"
      href="/finance"
      linkLabel="Open finance"
      className="lg:col-span-2"
    >
      {query.isLoading && <Skeleton className="h-64" />}
      {query.isError && <InlineError what="collections" />}
      {data && !hasAny && <InlineEmpty>No verified payments in the last six months.</InlineEmpty>}
      {data && hasAny && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="collectionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.red} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={COLORS.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={COLORS.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis
                width={56}
                tick={{ fontSize: 12, fill: COLORS.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `₱${v.toLocaleString('en-PH', { notation: 'compact' })}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [pesos(Number(v) * 100), 'Collected']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={COLORS.red}
                strokeWidth={2.5}
                fill="url(#collectionsFill)"
                dot={{ r: 3.5, fill: COLORS.red, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function BalancePanel({ query }: { query: ReturnType<typeof useReport<RevenueSummary>> }) {
  const data = query.data;
  const collectedPct = data ? percent(data.totalCollected, data.totalInvoiced) : 0;
  const branches = data?.byBranch.slice().sort((a, b) => b.invoiced - a.invoiced) ?? [];
  const topBranch = branches[0]?.invoiced ?? 0;

  return (
    <Panel icon={adminIcons.barChart} title="Invoiced vs collected" description="All non-cancelled invoices">
      {query.isLoading && <Skeleton className="h-64" />}
      {query.isError && <InlineError what="the revenue summary" />}
      {data && data.totalInvoiced === 0 && <InlineEmpty>No invoices issued yet.</InlineEmpty>}
      {data && data.totalInvoiced > 0 && (
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{collectedPct}%</span>
              <span className="text-xs text-slate-500">collected</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-amber-200" aria-hidden="true">
              <div className="h-full bg-red-700" style={{ width: `${Math.min(100, collectedPct)}%` }} />
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Invoiced</dt>
                <dd className="font-medium tabular-nums text-slate-900">{pesos(data.totalInvoiced)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-700" />
                  Collected
                </dt>
                <dd className="font-medium tabular-nums text-slate-900">{pesos(data.totalCollected)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  Outstanding
                </dt>
                <dd className="font-medium tabular-nums text-red-700">{pesos(data.outstanding)}</dd>
              </div>
            </dl>
          </div>

          {branches.length > 1 && (
            <div className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-700 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {adminIcons.mapPin}
                Invoiced by branch
              </h3>
              <ul className="space-y-3">
                {branches.map((row) => (
                  <li key={row.branchId}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-slate-600">{row.branchName}</span>
                      <span className="shrink-0 font-medium tabular-nums text-slate-900">{pesosCompact(row.invoiced)}</span>
                    </div>
                    <Meter value={percent(row.invoiced, topBranch)} color={COLORS.ink} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function FunnelPanel({ query }: { query: ReturnType<typeof useReport<EnrollmentFunnelRow[]>> }) {
  const counts = new Map(query.data?.map((row) => [row.status, row.count]));
  const rows = [
    ...FUNNEL_ORDER.filter((s) => counts.has(s)),
    ...Array.from(counts.keys()).filter((s) => !FUNNEL_ORDER.includes(s)),
  ].map((status) => ({ status, count: counts.get(status) ?? 0 }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(0, ...rows.map((r) => r.count));
  const won = rows.filter((r) => FUNNEL_WON.has(r.status)).reduce((s, r) => s + r.count, 0);
  const lost = rows.filter((r) => FUNNEL_LOST.has(r.status)).reduce((s, r) => s + r.count, 0);

  const summary = [
    { label: 'In progress', value: total - won - lost, color: 'bg-amber-400' },
    { label: 'Enrolled', value: won, color: 'bg-red-700' },
    { label: 'Dropped', value: lost, color: 'bg-slate-300' },
  ];

  return (
    <Panel
      icon={adminIcons.funnel}
      title="Enrollment funnel"
      description="Every application by its current stage"
      href="/enrollments"
    >
      {query.isLoading && <Skeleton className="h-72" />}
      {query.isError && <InlineError what="the enrollment funnel" />}
      {query.data && total === 0 && <InlineEmpty>No enrollment applications yet.</InlineEmpty>}
      {query.data && total > 0 && (
        <>
          <div className="mb-5 grid grid-cols-3 divide-x divide-slate-100 rounded-lg bg-slate-50 py-3 text-center">
            {summary.map((s) => (
              <div key={s.label} className="px-2">
                <p className="text-lg font-semibold tabular-nums text-slate-900">{s.value}</p>
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <ul className="space-y-3">
            {rows.map((row) => {
              const color = FUNNEL_WON.has(row.status) ? COLORS.red : FUNNEL_LOST.has(row.status) ? '#cbd5e1' : COLORS.amber;
              return (
                <li key={row.status} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[11rem_1fr_4.5rem]">
                  <span className="truncate text-slate-600">{humanize(row.status)}</span>
                  <Meter value={percent(row.count, max)} color={color} />
                  <span className="text-right tabular-nums">
                    <span className="font-semibold text-slate-900">{row.count}</span>
                    <span className="ml-1.5 text-slate-400">{percent(row.count, total)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

function AttendancePanel({ query }: { query: ReturnType<typeof useReport<AttendanceSummary>> }) {
  const data = query.data;
  const known = new Set(ATTENDANCE_STATUSES.map((s) => s.status));
  const slices = data
    ? [
        ...ATTENDANCE_STATUSES.map((s) => ({ ...s, count: data.counts[s.status] ?? 0 })),
        ...Object.entries(data.counts)
          .filter(([status]) => !known.has(status))
          .map(([status, count]) => ({ status, label: humanize(status), color: COLORS.ink, count })),
      ]
    : [];

  return (
    <Panel
      icon={adminIcons.checkSquare}
      title="Attendance"
      description="All recorded class sessions"
      href="/attendance"
    >
      {query.isLoading && <Skeleton className="h-72" />}
      {query.isError && <InlineError what="attendance" />}
      {data && data.total === 0 && <InlineEmpty>No attendance has been taken yet.</InlineEmpty>}
      {data && data.total > 0 && (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="relative h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices.filter((s) => s.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {slices
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <Cell key={s.status} fill={s.color} />
                    ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">
                {data.attendanceRate == null ? '—' : `${data.attendanceRate}%`}
              </span>
              <span className="text-xs text-slate-500">present</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-3">
            {slices.map((s) => (
              <li key={s.status} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-900">{s.count}</span>
                  <span className="ml-1.5 text-xs text-slate-400">{percent(s.count, data.total)}%</span>
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-500">Total records</span>
              <span className="font-semibold tabular-nums text-slate-900">{data.total}</span>
            </li>
          </ul>
        </div>
      )}
    </Panel>
  );
}

function ExamTablePanel({ query }: { query: ReturnType<typeof useReport<ExamPerformanceRow[]>> }) {
  const rows = query.data
    ?.slice()
    .sort((a, b) => b.attempts - a.attempts || a.title.localeCompare(b.title));

  return (
    <Panel
      icon={baseIcons.exams}
      title="Exam performance"
      description="Graded attempts only · pass rate at each exam's passing score"
      href="/exams"
      linkLabel="Manage exams"
      className="lg:col-span-2"
    >
      {query.isLoading && <Skeleton className="h-72" />}
      {query.isError && <InlineError what="exam performance" />}
      {rows && rows.length === 0 && <InlineEmpty>No exams have been created yet.</InlineEmpty>}
      {rows && rows.length > 0 && (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-5 pb-2.5 font-medium">Exam</th>
                <th scope="col" className="px-3 pb-2.5 text-right font-medium">Attempts</th>
                <th scope="col" className="w-40 px-3 pb-2.5 font-medium">Avg. score</th>
                <th scope="col" className="w-40 px-5 pb-2.5 font-medium">Pass rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => {
                const idle = row.attempts === 0;
                return (
                  <tr key={row.examId} className="transition-colors hover:bg-slate-50/70">
                    <td className={`max-w-0 truncate px-5 py-3 font-medium ${idle ? 'text-slate-400' : 'text-slate-900'}`} title={row.title}>
                      {row.title}
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums ${idle ? 'text-slate-400' : 'text-slate-700'}`}>
                      {row.attempts}
                    </td>
                    <td className="px-3 py-3">
                      {row.averageScorePct == null ? (
                        <span className="text-xs text-slate-400">No attempts</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <Meter value={row.averageScorePct} color={COLORS.ink} label={`Average score for ${row.title}`} />
                          <span className="w-11 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
                            {row.averageScorePct}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {row.passRate == null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <Meter value={row.passRate} color={passTone(row.passRate)} label={`Pass rate for ${row.title}`} />
                          <span className="w-11 shrink-0 text-right text-xs font-medium tabular-nums text-slate-700">
                            {row.passRate}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function GradingActivityPanel({ query }: { query: ReturnType<typeof useReport<MonthlyPoint[]>> }) {
  const hasAny = query.data?.some((p) => p.value > 0);
  const total = query.data?.reduce((sum, p) => sum + p.value, 0) ?? 0;

  return (
    <Panel icon={adminIcons.history} title="Grading activity" description="Attempts graded per month">
      {query.isLoading && <Skeleton className="h-64" />}
      {query.isError && <InlineError what="grading activity" />}
      {query.data && !hasAny && <InlineEmpty>No attempts graded in the last six months.</InlineEmpty>}
      {query.data && hasAny && (
        <>
          <p className="mb-3 text-sm text-slate-500">
            <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span> graded in 6 months
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={query.data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: COLORS.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: COLORS.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Graded']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {query.data.map((p, i) => (
                    <Cell key={p.month} fill={i === query.data!.length - 1 ? COLORS.red : '#fca5a5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const funnel = useReport<EnrollmentFunnelRow[]>('enrollment-funnel', '/v1/reports/enrollment-funnel');
  const revenue = useReport<RevenueSummary>('revenue', '/v1/reports/revenue');
  const attendance = useReport<AttendanceSummary>('attendance', '/v1/reports/attendance');
  const exams = useReport<ExamPerformanceRow[]>('exam-performance', '/v1/reports/exam-performance');
  const attemptsTrend = useReport<MonthlyPoint[]>('attempts-trend', '/v1/reports/attempts-trend');

  const funnelTotal = funnel.data?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const funnelWon = funnel.data?.filter((r) => FUNNEL_WON.has(r.status)).reduce((s, r) => s + r.count, 0) ?? 0;

  // Pass rate across all graded attempts, weighted so a 1-attempt quiz
  // doesn't count the same as a 200-attempt mock board exam.
  const graded = exams.data?.filter((r) => r.attempts > 0 && r.passRate != null) ?? [];
  const gradedAttempts = graded.reduce((sum, r) => sum + r.attempts, 0);
  const overallPassRate =
    gradedAttempts > 0
      ? Math.round((graded.reduce((sum, r) => sum + (r.passRate ?? 0) * r.attempts, 0) / gradedAttempts) * 10) / 10
      : null;

  const asOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Enrollment, finance, attendance and exam results for the whole organization · as of ${asOf}`}
        action={
          <Button variant="secondary" onClick={() => window.print()} className="inline-flex shrink-0 items-center gap-2 print:hidden">
            {printIcon}
            Print
          </Button>
        }
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={adminIcons.userPlus}
          tone="red"
          label="Enrollment applications"
          value={funnelTotal.toLocaleString()}
          detail={`${funnelWon.toLocaleString()} enrolled or completed`}
          isLoading={funnel.isLoading}
          isError={funnel.isError}
        />
        <KpiTile
          icon={adminIcons.creditCard}
          tone="amber"
          label="Revenue collected"
          value={revenue.data ? pesosCompact(revenue.data.totalCollected) : '—'}
          delta={monthOverMonth(revenue.data?.monthly)}
          detail={
            revenue.data && revenue.data.totalInvoiced > 0
              ? `${percent(revenue.data.totalCollected, revenue.data.totalInvoiced)}% of ${pesosCompact(revenue.data.totalInvoiced)} invoiced`
              : 'Nothing invoiced yet'
          }
          isLoading={revenue.isLoading}
          isError={revenue.isError}
        />
        <KpiTile
          icon={adminIcons.checkSquare}
          tone="ink"
          label="Attendance rate"
          value={attendance.data?.attendanceRate == null ? '—' : `${attendance.data.attendanceRate}%`}
          detail={attendance.data ? `${attendance.data.total.toLocaleString()} records` : undefined}
          isLoading={attendance.isLoading}
          isError={attendance.isError}
        />
        <KpiTile
          icon={baseIcons.exams}
          tone="amber"
          label="Exam pass rate"
          value={overallPassRate == null ? '—' : `${overallPassRate}%`}
          detail={`${gradedAttempts.toLocaleString()} graded attempts`}
          isLoading={exams.isLoading}
          isError={exams.isError}
        />
      </section>

      <section aria-label="Finance" className="grid gap-6 lg:grid-cols-3">
        <CollectionsTrendPanel query={revenue} />
        <BalancePanel query={revenue} />
      </section>

      <section aria-label="Enrollment and attendance" className="grid gap-6 lg:grid-cols-2">
        <FunnelPanel query={funnel} />
        <AttendancePanel query={attendance} />
      </section>

      <section aria-label="Exams" className="grid gap-6 lg:grid-cols-3">
        <ExamTablePanel query={exams} />
        <GradingActivityPanel query={attemptsTrend} />
      </section>
    </div>
  );
}
