'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, PanelMessage, icons } from '@/components/student-ui';
import type { AttemptSummary } from '@/lib/student-hooks';

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Score trend: graded attempts over time against each exam's passing mark.
// Shared by the student home and Performance pages.
// ---------------------------------------------------------------------------

interface TrendPoint {
  id: string;
  label: string;
  title: string;
  pct: number;
  passMark: number;
  passed: boolean;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-[0_10px_24px_-12px_rgb(15_23_42/0.3)]">
      <p className="truncate font-semibold text-slate-900">{p.title}</p>
      <p className="mt-0.5 text-slate-500">{p.label}</p>
      <p className="mt-1.5 tabular-nums text-slate-700">
        <span className="font-semibold text-slate-900">{p.pct}%</span> · passing mark {p.passMark}%
      </p>
      <p className={`mt-0.5 font-semibold ${p.passed ? 'text-emerald-700' : 'text-amber-700'}`}>{p.passed ? 'Passed' : 'Below passing'}</p>
    </div>
  );
}

export function ScoreTrend({
  attempts,
  loading,
  error,
  limit = 12,
  height = 220,
  icon = icons.progress,
}: {
  attempts: AttemptSummary[];
  loading: boolean;
  error: boolean;
  limit?: number;
  height?: number;
  icon?: React.ReactNode;
}) {
  // Graded attempts only, oldest first, the last `limit`. The passing mark is per exam
  // (raw points), so it's plotted as its own percentage line.
  const data = useMemo<TrendPoint[]>(
    () =>
      attempts
        .filter((a) => a.status === 'GRADED' && a.score !== undefined && a.maxScore)
        .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
        .slice(-limit)
        .map((a) => ({
          id: a.id,
          label: shortDate(a.submittedAt ?? a.startedAt),
          title: a.exam.title,
          pct: Math.round((a.score! / a.maxScore!) * 100),
          passMark: Math.min(100, Math.round((a.exam.passingScore / a.maxScore!) * 100)),
          passed: Boolean(a.passed),
        })),
    [attempts, limit],
  );

  const latest = data.at(-1);
  const prev = data.at(-2);
  const delta = latest && prev ? latest.pct - prev.pct : null;

  return (
    <Panel
      title="Score Trend"
      icon={icon}
      action={
        delta !== null ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
              delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts vs. previous
          </span>
        ) : undefined
      }
    >
      {loading && <div className="animate-pulse rounded-xl bg-slate-100" style={{ height }} />}
      {!loading && error && <PanelMessage tone="error">Couldn&apos;t load your exam results.</PanelMessage>}
      {!loading && !error && data.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.progress}</span>
          <span>Your scores will chart here once an exam is graded.</span>
          <Link href="/student/exams" className="font-semibold text-red-700 underline underline-offset-4">
            Browse open exams
          </Link>
        </PanelMessage>
      )}
      {!loading && !error && data.length > 0 && (
        <figure className="flex-1">
          <figcaption className="sr-only">
            Score by exam, oldest first: {data.map((d) => `${d.title} ${d.pct}% (passing ${d.passMark}%)`).join(', ')}
          </figcaption>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b91c1c" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }} />
              <Line
                type="stepAfter"
                dataKey="passMark"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#b91c1c"
                strokeWidth={2.5}
                fill="url(#score-fill)"
                dot={(props: { cx?: number; cy?: number; index?: number; payload?: TrendPoint }) => (
                  <circle
                    key={props.payload?.id ?? props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={4.5}
                    stroke="#fff"
                    strokeWidth={2}
                    fill={props.payload?.passed ? '#059669' : '#d97706'}
                  />
                )}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#b91c1c' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-red-700" aria-hidden /> Your score
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-[1.5px] border-dashed border-slate-400" aria-hidden /> Passing mark
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden /> Passed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden /> Below passing
            </span>
          </div>
        </figure>
      )}
    </Panel>
  );
}
