'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Mobile-first primitives for the student route group. Same red-700 /
// slate token palette as the admin dashboard (components/ui.tsx), but a
// different shell: single-column cards + a fixed bottom tab bar instead of
// a sidebar and data tables.

export interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function BottomTabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? 'text-red-700' : 'text-slate-500'
              }`}
              style={{ minHeight: 44 }}
            >
              <span className={active ? 'text-red-700' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">{children}</div>;
}

export function StudentPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h2>;
}

export function ProgressBar({ value, max, tone = 'red' }: { value: number; max: number; tone?: 'red' | 'green' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = tone === 'green' ? 'bg-emerald-600' : 'bg-red-700';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Tab bar icons (inline SVG, no icon package dependency) ---------------

export const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  learn: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 6.5C4 5.7 4.7 5 6 5h5v14H6c-1.3 0-2-.7-2-1.5v-11ZM20 6.5c0-.8-.7-1.5-2-1.5h-5v14h5c1.3 0 2-.7 2-1.5v-11Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  ),
  exams: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M7 3.5h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2v-16a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 11.5h6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={4} y={5.5} width={16} height={15} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={8} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
};
