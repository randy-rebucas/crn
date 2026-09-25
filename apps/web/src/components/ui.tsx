'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { UseFormRegisterReturn } from 'react-hook-form';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  // Mount as soon as it opens (adjusting state during render, not in an
  // effect); the effect below only schedules the slide-in / delayed unmount.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setEntered(false));
    const timeout = setTimeout(() => setMounted(false), 200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-xl transition-transform duration-200 ease-out ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-red-700 text-white hover:bg-red-800 disabled:opacity-50',
    secondary: 'border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50',
    ghost: 'text-slate-600 hover:bg-slate-100 disabled:opacity-50',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50',
  }[variant];

  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none disabled:bg-slate-50"
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none disabled:bg-slate-50"
      {...props}
    />
  );
}

export function MarkdownField({
  registration,
  value,
  placeholder,
  rows = 6,
}: {
  registration: UseFormRegisterReturn;
  value: string | undefined;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div>
      <div className="mb-1 flex gap-3 text-xs font-medium">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={tab === 'write' ? 'text-red-600' : 'text-slate-400'}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={tab === 'preview' ? 'text-red-600' : 'text-slate-400'}
        >
          Preview
        </button>
      </div>
      {tab === 'write' ? (
        <Textarea rows={rows} placeholder={placeholder} {...registration} />
      ) : (
        <div className="min-h-[132px] space-y-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 [&_a]:text-red-600 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
          {value ? <ReactMarkdown>{value}</ReactMarkdown> : <p className="text-slate-400">Nothing to preview yet.</p>}
        </div>
      )}
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
      {...props}
    />
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  gold: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
};

// Status -> tone mapping shared across modules so the same word always
// reads the same color (blueprint Section 26: gold = achievement/positive,
// red = attention/blocked, neutral = in-progress/administrative).
const STATUS_TONE: Record<string, keyof typeof BADGE_TONES> = {
  DRAFT: 'neutral',
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'blue',
  REQUIREMENTS_INCOMPLETE: 'red',
  APPROVED: 'blue',
  PAYMENT_PENDING: 'gold',
  PAYMENT_VERIFIED: 'blue',
  ENROLLED: 'green',
  COMPLETED: 'gold',
  CANCELLED: 'red',
  REJECTED: 'red',
  REVIEW: 'blue',
  PUBLISHED: 'green',
  ARCHIVED: 'neutral',
  UNPAID: 'red',
  PARTIALLY_PAID: 'gold',
  PAID: 'green',
  PENDING: 'gold',
  VERIFIED: 'green',
  ACTIVE: 'green',
  ON_LEAVE: 'gold',
  UPCOMING: 'blue',
  REQUESTED: 'gold',
  OFFICER_APPROVED: 'blue',
  PROCESSED: 'green',
  LEAD: 'neutral',
  INQUIRY: 'blue',
  APPLICATION: 'blue',
  APPLICANT: 'gold',
  LOST: 'red',
  GRADED: 'green',
  PASSED: 'green',
  FAILED: 'red',
  IN_PROGRESS: 'blue',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
  );
}

export function LoadingState() {
  return <div className="p-6 text-sm text-slate-500">Loading…</div>;
}
