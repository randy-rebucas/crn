'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { Button, Card, ErrorState, PageHeader } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

interface AuditLog {
  id: string;
  actorId: string | null;
  actor: { id: string; firstName: string; lastName: string; email: string } | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  beforeState: unknown;
  afterState: unknown;
  reason: string | null;
  createdAt: string;
}

interface Filters {
  resource?: string;
  resourceId?: string;
  actorId?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
}

// The API returns at most this many rows, newest first (audit.controller.ts).
const API_LIMIT = 200;

type Tone = 'alert' | 'change' | 'create' | 'neutral';

// Events worth a second look: failed sign-ins, token reuse, rejected payments.
function toneOf(action: string): Tone {
  if (/(failed|reuse_detected|rejected)$/.test(action)) return 'alert';
  if (/\.created$|\.issued$|\.self_registered$/.test(action)) return 'create';
  if (/(updated|status_changed|graded|verified|published|marked|completed)$/.test(action)) return 'change';
  return 'neutral';
}

const TONES: Record<Tone, { chip: string; iconBox: string; bar: string }> = {
  alert: { chip: 'bg-red-100 text-red-700', iconBox: 'bg-red-700 text-white', bar: '#b91c1c' },
  change: { chip: 'bg-amber-100 text-amber-800', iconBox: 'bg-amber-100 text-amber-700', bar: '#f59e0b' },
  create: { chip: 'bg-emerald-100 text-emerald-800', iconBox: 'bg-emerald-50 text-emerald-700', bar: '#059669' },
  neutral: { chip: 'bg-slate-100 text-slate-700', iconBox: 'bg-slate-100 text-slate-600', bar: '#94a3b8' },
};

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  auth: adminIcons.key,
  user: adminIcons.users,
  role: adminIcons.shield,
  settings: baseIcons.settings,
  staff: adminIcons.users,
  student: adminIcons.users,
  instructor: baseIcons.profile,
  lead: adminIcons.userPlus,
  admission: adminIcons.clipboardCheck,
  enrollment: adminIcons.userPlus,
  requirement: adminIcons.fileText,
  requirement_submission: adminIcons.fileText,
  payment: adminIcons.creditCard,
  invoice: adminIcons.fileText,
  pricing: adminIcons.creditCard,
  refund: adminIcons.history,
  exam: baseIcons.exams,
  attempt: baseIcons.exams,
  question: baseIcons.exams,
  certificate: baseIcons.certificate,
  attendance: adminIcons.checkSquare,
  schedule: baseIcons.schedule,
  class: adminIcons.grid,
  room: adminIcons.mapPin,
  batch: adminIcons.layers,
  program: adminIcons.layers,
  course: baseIcons.learn,
  module: baseIcons.learn,
  lesson: baseIcons.learn,
  subject: baseIcons.learn,
  material: adminIcons.fileText,
  announcement: adminIcons.bell,
};

function actorName(log: AuditLog) {
  if (log.actor) return `${log.actor.firstName} ${log.actor.lastName}`.trim() || log.actor.email;
  return log.actorId ? 'Unknown user' : 'System';
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayHeading(key: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function isoDate(d: Date) {
  return dayKey(d.toISOString());
}

// `to` is inclusive of the whole day the user picked.
function toParams(filters: Filters) {
  return {
    resource: filters.resource || undefined,
    resourceId: filters.resourceId || undefined,
    actorId: filters.actorId || undefined,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  };
}

const PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'today', label: 'Today', days: 0 },
  { id: '7d', label: '7 days', days: 6 },
  { id: '30d', label: '30 days', days: 29 },
  { id: 'all', label: 'All time', days: null },
];

// ---------------------------------------------------------------------------
// Before / after

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value === '' ? '""' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function StateDiff({ before, after }: { before: unknown; after: unknown }) {
  // Both sides are objects: show only the fields that changed, side by side.
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    );
    if (keys.length === 0) return <p className="text-xs text-slate-500">No field values changed.</p>;
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Field</th>
              <th scope="col" className="px-3 py-2 font-medium">Before</th>
              <th scope="col" className="px-3 py-2 font-medium">After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {keys.map((k) => (
              <tr key={k} className="align-top">
                <td className="px-3 py-2 font-sans font-medium text-slate-700">{k}</td>
                <td className="max-w-[16rem] break-words px-3 py-2 text-red-700 line-through decoration-red-300">
                  {formatValue(before[k])}
                </td>
                <td className="max-w-[16rem] break-words px-3 py-2 text-emerald-700">{formatValue(after[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const blocks = [
    { label: 'Before', value: before },
    { label: 'After', value: after },
  ].filter((b) => b.value !== null && b.value !== undefined);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {blocks.map((b) => (
        <div key={b.label}>
          <p className="mb-1 text-xs font-medium text-slate-500">{b.label}</p>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(b.value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry

function Entry({ log, onFilterRecord }: { log: AuditLog; onFilterRecord: (log: AuditLog) => void }) {
  const tone = toneOf(log.action);
  const domain = log.action.split('.')[0];
  const hasState = log.beforeState != null || log.afterState != null;
  const time = new Date(log.createdAt);

  return (
    <li className={`px-4 py-3.5 ${tone === 'alert' ? 'bg-red-50/40' : ''}`}>
      <div className="flex gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px] ${TONES[tone].iconBox}`}
          aria-hidden="true"
        >
          {DOMAIN_ICONS[domain] ?? DOMAIN_ICONS[log.resource] ?? adminIcons.history}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="text-sm text-slate-900">
              <span className="font-semibold" title={log.actor?.email}>
                {actorName(log)}
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone].chip}`}>
                {humanize(log.action)}
              </span>
            </p>
            <time
              dateTime={log.createdAt}
              title={time.toLocaleString()}
              className="shrink-0 text-xs tabular-nums text-slate-500"
            >
              {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </time>
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>
              {humanize(log.resource)}
              {log.resourceId && (
                <button
                  type="button"
                  onClick={() => onFilterRecord(log)}
                  title={`Show every event for ${log.resourceId}`}
                  className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
                >
                  {log.resourceId.slice(0, 8)}
                </button>
              )}
            </span>
            {log.ipAddress && (
              <span className="inline-flex items-center gap-1 [&_svg]:h-3 [&_svg]:w-3">
                <span className="text-slate-400">{adminIcons.mapPin}</span>
                <span className="font-mono">{log.ipAddress}</span>
              </span>
            )}
          </p>

          {log.reason && <p className="mt-1.5 text-sm text-slate-700">“{log.reason}”</p>}

          {(hasState || log.userAgent) && (
            <details className="group mt-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-red-600 [&::-webkit-details-marker]:hidden">
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {hasState ? 'Show changes' : 'Show details'}
              </summary>
              <div className="mt-3 space-y-3">
                {hasState && <StateDiff before={log.beforeState} after={log.afterState} />}
                {log.userAgent && (
                  <p className="break-words text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Device: </span>
                    {log.userAgent}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [preset, setPreset] = useState('all');

  const { data, isLoading, isError, isFetching } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', filters],
    queryFn: async () => (await apiClient.get('/v1/audit-logs', { params: toParams(filters) })).data,
    placeholderData: (prev) => prev,
  });

  // Every person and area that appears anywhere in the log, not just in the
  // 200 rows currently loaded (GET /v1/audit-logs/facets).
  const facetsQuery = useQuery<{
    resources: string[];
    actors: { id: string; firstName: string; lastName: string; email: string }[];
  }>({
    queryKey: ['audit-logs', 'facets'],
    queryFn: async () => (await apiClient.get('/v1/audit-logs/facets')).data,
    staleTime: 60_000,
  });
  const actorOptions = (facetsQuery.data?.actors ?? []).map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`.trim() || a.email,
  }));
  const resourceOptions = facetsQuery.data?.resources ?? [];

  const logs = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const actors = new Set(logs.map((l) => l.actorId ?? 'system'));
    const alerts = logs.filter((l) => toneOf(l.action) === 'alert');
    const failedLogins = logs.filter((l) => l.action === 'auth.login.failed').length;
    const byResource = new Map<string, number>();
    for (const l of logs) byResource.set(l.resource, (byResource.get(l.resource) ?? 0) + 1);
    const top = Array.from(byResource.entries()).sort((a, b) => b[1] - a[1])[0];
    return { actors: actors.size, alerts: alerts.length, failedLogins, top };
  }, [logs]);

  // Events per day across the span of the loaded results, zero-filled, last 30 days at most.
  const activity = useMemo(() => {
    if (logs.length === 0) return [];
    const counts = new Map<string, { total: number; alerts: number }>();
    for (const l of logs) {
      const key = dayKey(l.createdAt);
      const c = counts.get(key) ?? { total: 0, alerts: 0 };
      c.total += 1;
      if (toneOf(l.action) === 'alert') c.alerts += 1;
      counts.set(key, c);
    }
    const newest = new Date(logs[0].createdAt);
    const oldest = new Date(logs[logs.length - 1].createdAt);
    const spanDays = Math.min(29, Math.round((startOf(newest) - startOf(oldest)) / 86_400_000));
    const days = [];
    for (let i = spanDays; i >= 0; i--) {
      const d = new Date(startOf(newest) - i * 86_400_000);
      const key = dayKey(d.toISOString());
      const c = counts.get(key) ?? { total: 0, alerts: 0 };
      days.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), ...c });
    }
    return days;
  }, [logs]);

  const groups = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const l of logs) {
      const key = dayKey(l.createdAt);
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return Array.from(map.entries());
  }, [logs]);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    if (!p || p.days === null) {
      setFilters((f) => ({ ...f, from: undefined, to: undefined }));
      return;
    }
    const from = new Date();
    from.setDate(from.getDate() - p.days);
    setFilters((f) => ({ ...f, from: isoDate(from), to: undefined }));
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const clearFilters = () => {
    setFilters({});
    setPreset('all');
  };

  const tiles = [
    {
      label: 'Events',
      value: logs.length === API_LIMIT ? `${API_LIMIT}+` : logs.length,
      detail: hasFilters ? 'matching these filters' : 'most recent',
      icon: adminIcons.history,
      tone: 'bg-red-700 text-white',
    },
    { label: 'People involved', value: stats.actors, detail: 'including system events', icon: adminIcons.users, tone: 'bg-slate-900 text-white' },
    {
      label: 'Security alerts',
      value: stats.alerts,
      detail: `${stats.failedLogins} failed sign-in${stats.failedLogins === 1 ? '' : 's'}`,
      icon: adminIcons.shield,
      tone: stats.alerts > 0 ? 'bg-red-700 text-white' : 'bg-emerald-600 text-white',
    },
    {
      label: 'Most active area',
      value: stats.top ? humanize(stats.top[0]) : '—',
      detail: stats.top ? `${stats.top[1]} events` : 'no events',
      icon: adminIcons.pieChart,
      tone: 'bg-amber-400 text-slate-900',
    },
  ];

  const selectClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="A permanent, read-only record of who did what, and when. Newest first."
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Person</span>
            <select
              value={filters.actorId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value || undefined }))}
              className={selectClass}
            >
              <option value="">Everyone</option>
              {actorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Area</span>
            <select
              value={filters.resource ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, resource: e.target.value || undefined, resourceId: undefined }))
              }
              className={selectClass}
            >
              <option value="">All areas</option>
              {resourceOptions.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 xl:col-span-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">When</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Date range">
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(p.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={preset === 'custom'}
                onClick={() => setPreset('custom')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                  preset === 'custom' ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom
              </button>
            </div>
          </div>
        </div>

        {preset === 'custom' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">From</span>
              <input
                type="date"
                value={filters.from ?? ''}
                max={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
                className={selectClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">To</span>
              <input
                type="date"
                value={filters.to ?? ''}
                min={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
                className={selectClass}
              />
            </label>
          </div>
        )}

        {(hasFilters || filters.resourceId) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
            {filters.resourceId && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-red-800">
                Record <code className="font-mono">{filters.resourceId.slice(0, 8)}</code>
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, resourceId: undefined }))}
                  aria-label="Remove record filter"
                  className="rounded-full p-0.5 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-red-600"
            >
              Clear all filters
            </button>
            {isFetching && <span className="text-slate-400">Updating…</span>}
          </div>
        )}
      </Card>

      {isError && <ErrorState message="Couldn't load the audit log. Refresh the page to try again." />}

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {data && (
        <>
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label} className="flex items-center gap-4 p-5">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.tone}`} aria-hidden="true">
                  {t.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{t.label}</p>
                  <p className="truncate text-2xl font-semibold tabular-nums text-slate-900">{t.value}</p>
                  <p className="truncate text-xs text-slate-500">{t.detail}</p>
                </div>
              </Card>
            ))}
          </section>

          {activity.length > 1 && (
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Activity by day</h2>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Events
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-700" /> Includes alerts
                  </span>
                </div>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      formatter={(v, _n, item) => {
                        const alerts = (item?.payload as { alerts?: number } | undefined)?.alerts ?? 0;
                        return [`${v}${alerts ? ` (${alerts} alert${alerts === 1 ? '' : 's'})` : ''}`, 'Events'];
                      }}
                    />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={22}>
                      {activity.map((d) => (
                        <Cell key={d.key} fill={d.alerts > 0 ? TONES.alert.bar : TONES.neutral.bar} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  {adminIcons.history}
                </span>
                <p className="text-sm font-medium text-slate-900">No events found</p>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  {hasFilters ? 'Nothing matches these filters. Try a wider date range.' : 'Actions will be recorded here as people use the system.'}
                </p>
                {hasFilters && (
                  <Button variant="secondary" onClick={clearFilters} className="mt-4">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                {groups.map(([key, items]) => (
                  <section key={key} aria-labelledby={`day-${key}`}>
                    <h2
                      id={`day-${key}`}
                      className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600"
                    >
                      {dayHeading(key)}
                      <span className="font-normal tabular-nums text-slate-400">
                        {items.length} {items.length === 1 ? 'event' : 'events'}
                      </span>
                    </h2>
                    <ul className="divide-y divide-slate-100">
                      {items.map((log) => (
                        <Entry
                          key={log.id}
                          log={log}
                          onFilterRecord={(l) => setFilters((f) => ({ ...f, resource: l.resource, resourceId: l.resourceId ?? undefined }))}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                {logs.length === API_LIMIT && (
                  <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
                    Showing the latest {API_LIMIT} matching events. Narrow the date range or pick a person to see older ones.
                  </p>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function startOf(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
