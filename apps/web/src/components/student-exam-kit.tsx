'use client';

import Link from 'next/link';
import { examGlyphs } from '@/components/student-exam-list';

// Shared pieces for the exam detail and attempt pages: question-format and
// difficulty vocabulary, outcome glyphs, and the small bar graphs both pages
// draw (score against the passing mark, stacked mixes, per-group accuracy).

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_RESPONSE'
  | 'TRUE_FALSE'
  | 'IDENTIFICATION'
  | 'NUMERICAL'
  | 'ESSAY'
  | 'IMAGE_BASED';

export type Difficulty = 'EASY' | 'MODERATE' | 'DIFFICULT';

export const kitGlyphs = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="m5.5 12.5 4 4 9-9.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
  dash: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M7 12h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
  hourglass: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M7 3.5h10M7 20.5h10M8 3.5v2.8a4 4 0 0 0 1.6 3.2L12 11.5l2.4-2a4 4 0 0 0 1.6-3.2V3.5M8 20.5v-2.8a4 4 0 0 1 1.6-3.2l2.4-2 2.4 2a4 4 0 0 1 1.6 3.2v2.8"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M16 10H5m4.5-4.5L5 10l4.5 4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  radio: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx={12} cy={12} r={8} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={3.5} fill="currentColor" />
    </svg>
  ),
  checks: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x={3.5} y={3.5} width={17} height={17} rx={3} stroke="currentColor" strokeWidth={1.7} />
      <path d="m7.5 12 3 3 6-6.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  toggle: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x={2.5} y={7} width={19} height={10} rx={5} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={12} r={2.6} fill="currentColor" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M5 6.5h14M12 6.5v12M9 18.5h6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  hash: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15M4 15h15" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  pen: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="m14.5 5.5 4 4M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19 4 20Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x={3.5} y={4.5} width={17} height={15} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={9} cy={10} r={1.6} stroke="currentColor" strokeWidth={1.5} />
      <path d="m4 17 5-4.5 3.5 3 3-2.5L20 17" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12l1-7Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x={5} y={10.5} width={14} height={10} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
};

export const QTYPE_META: Record<QuestionType, { label: string; icon: React.ReactNode }> = {
  MULTIPLE_CHOICE: { label: 'Multiple choice', icon: kitGlyphs.radio },
  MULTIPLE_RESPONSE: { label: 'Select all that apply', icon: kitGlyphs.checks },
  TRUE_FALSE: { label: 'True or false', icon: kitGlyphs.toggle },
  IDENTIFICATION: { label: 'Identification', icon: kitGlyphs.text },
  NUMERICAL: { label: 'Numerical', icon: kitGlyphs.hash },
  ESSAY: { label: 'Essay', icon: kitGlyphs.pen },
  IMAGE_BASED: { label: 'Image-based', icon: kitGlyphs.image },
};

export function qtypeMeta(type: string) {
  return QTYPE_META[type as QuestionType] ?? { label: type.replace(/_/g, ' ').toLowerCase(), icon: examGlyphs.list };
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; bar: string; dot: string }> = {
  EASY: { label: 'Easy', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  MODERATE: { label: 'Moderate', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  DIFFICULT: { label: 'Difficult', bar: 'bg-red-700', dot: 'bg-red-700' },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['EASY', 'MODERATE', 'DIFFICULT'];

export function pctOf(value: number, max: number) {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(fromIso: string, toIso: string) {
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (mins < 1) return 'Under 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 transition hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
    >
      {kitGlyphs.back}
      {children}
    </Link>
  );
}

// Big score bar: fill to the score, a tick at the passing mark, labelled
// ends. Same visual grammar as the catalog's ScoreBar, at hero scale.
export function ScoreMeter({ pct, passPct, passed }: { pct: number; passPct: number; passed: boolean }) {
  return (
    <div>
      <div className="relative h-3.5 rounded-full bg-slate-100" aria-hidden>
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${passed ? 'bg-emerald-600' : 'bg-amber-500'}`}
          style={{ width: `${Math.max(pct, 1.5)}%` }}
        />
        <span className="absolute -bottom-1.5 -top-1.5 w-0.5 rounded-full bg-slate-900" style={{ left: `calc(${passPct}% - 1px)` }} />
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-slate-500" aria-hidden>
        <span className="absolute left-0">0%</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-slate-900"
          style={{ left: `clamp(2.5rem, ${passPct}%, calc(100% - 2.5rem))` }}
        >
          Pass {passPct}%
        </span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  );
}

// Stacked horizontal bar with a legend beneath: the share of each segment.
export interface Segment {
  key: string;
  label: string;
  value: number;
  bar: string;
}

export function SegmentBar({ segments, unit, caption }: { segments: Segment[]; unit: [string, string]; caption: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.filter((s) => s.value > 0);
  return (
    <figure>
      <figcaption className="sr-only">
        {caption}: {segments.map((s) => `${s.label} ${s.value}`).join(', ')}
      </figcaption>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {shown.map((s) => (
          <span key={s.key} className={`h-full first:rounded-l-full last:rounded-r-full ${s.bar}`} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600" aria-hidden>
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.bar}`} />
            {s.label}
            <span className="font-semibold tabular-nums text-slate-900">
              {s.value} {s.value === 1 ? unit[0] : unit[1]}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// One labelled bar per group. `value` is 0–100; `tone` colours the fill.
export interface GroupBar {
  key: string;
  label: string;
  icon?: React.ReactNode;
  value: number;
  detail: string;
  tone: string;
}

export function GroupBars({ rows, caption, marker }: { rows: GroupBar[]; caption: string; marker?: number }) {
  return (
    <figure>
      <figcaption className="sr-only">
        {caption}: {rows.map((r) => `${r.label} ${r.value}% (${r.detail})`).join('; ')}
      </figcaption>
      <ul className="space-y-3.5" aria-hidden>
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                {r.icon && <span className="shrink-0 text-slate-400">{r.icon}</span>}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {r.detail} <span className="ml-1 font-bold text-slate-900">{r.value}%</span>
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${r.tone}`} style={{ width: `${Math.max(r.value, r.value > 0 ? 2 : 0)}%` }} />
              {marker !== undefined && (
                <span className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-slate-900/70" style={{ left: `calc(${marker}% - 1px)` }} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function ResultChip({ tone, icon, children }: { tone: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5 ${tone}`}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
