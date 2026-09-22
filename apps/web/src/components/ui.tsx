import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

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
