'use client';

import { useQuery } from '@tanstack/react-query';
import { forwardRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { humanize as baseHumanize } from '@/lib/format';

export { errorMessage } from '@/lib/errors';
export { FilterChips, FormError, SearchBox } from '@/components/admin-kit';

// ---------------------------------------------------------------------------
// Types (mirror apps/api list responses — see *.service.ts findAll includes)
// ---------------------------------------------------------------------------

export interface Program {
  id: string;
  name: string;
}

export interface Pricing {
  id: string;
  programId: string;
  amount: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  program?: { id: string; name: string };
}

export interface Enrollment {
  id: string;
  status: string;
  student: { user: { firstName: string; lastName: string } };
  program: { id: string; name: string } | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  verifiedAt?: string | null;
  receipt?: { receiptNumber: string } | null;
  invoice?: { id: string; enrollment: { student: { user: { firstName: string; lastName: string } } } };
  /** Only on invoice-embedded payments: refunds already paid out against it. */
  refunds?: { id: string; amount: number }[];
}

export interface Invoice {
  id: string;
  enrollmentId: string;
  amount: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  payments: Payment[];
  enrollment?: {
    student: { user: { firstName: string; lastName: string } };
    program: { name: string } | null;
  };
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  requestedById: string;
  approvedById: string | null;
  processedAt: string | null;
  createdAt: string;
  payment?: {
    amount: number;
    method: string;
    receipt: { receiptNumber: string } | null;
    invoice: { enrollment: { student: { user: { firstName: string; lastName: string } } } };
  };
}

export const PAYMENT_METHODS = ['CASH', 'GCASH', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const;

// ---------------------------------------------------------------------------
// Money — every amount in the API is an integer in centavos.
// ---------------------------------------------------------------------------

export function money(cents: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function moneyCompact(cents: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(
      cents / 100,
    );
  } catch {
    return money(cents, currency);
  }
}

/** "1,500.50" → 150050. Returns NaN for anything that isn't a money amount. */
export function toCents(input: string) {
  const cleaned = input.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Derived invoice facts
// ---------------------------------------------------------------------------

/** Refunds already paid out against this invoice's payments. */
export function refundedOf(invoice: Invoice) {
  return invoice.payments.reduce((sum, p) => sum + (p.refunds ?? []).reduce((s, r) => s + r.amount, 0), 0);
}

/** Net paid, same rule as InvoicesService.recomputeStatus: verified payments minus paid-out refunds. */
export function paidOf(invoice: Invoice) {
  const verified = invoice.payments.filter((p) => p.status === 'VERIFIED').reduce((sum, p) => sum + p.amount, 0);
  return Math.max(verified - refundedOf(invoice), 0);
}

export function outstandingOf(invoice: Invoice) {
  return invoice.status === 'CANCELLED' ? 0 : Math.max(invoice.totalAmount - paidOf(invoice), 0);
}

export function isOverdue(invoice: Invoice) {
  if (!invoice.dueDate || invoice.status === 'PAID' || invoice.status === 'CANCELLED') return false;
  const due = new Date(invoice.dueDate);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export function dueLabel(iso: string) {
  const due = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `In ${days} days`;
  return days === -1 ? '1 day overdue' : `${-days} days overdue`;
}

export function personName(user?: { firstName: string; lastName: string }) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown student';
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function humanize(value: string) {
  return value.toUpperCase() === 'GCASH' ? 'GCash' : baseHumanize(value);
}

// ---------------------------------------------------------------------------
// Shared queries — one cache per list, reused by every tab and the summary.
// ---------------------------------------------------------------------------

export function useInvoices(enabled = true) {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => (await apiClient.get('/v1/invoices')).data,
    enabled,
  });
}

export function useAllPayments(enabled = true) {
  return useQuery<Payment[]>({
    queryKey: ['payments', 'all'],
    queryFn: async () => (await apiClient.get('/v1/payments')).data,
    enabled,
  });
}

// Every pending payment, uncapped — the verification queue can't come from
// useAllPayments, which the API caps at the 200 most recent payments.
export function usePendingPayments(enabled = true) {
  return useQuery<Payment[]>({
    queryKey: ['payments', 'pending'],
    queryFn: async () => (await apiClient.get('/v1/payments', { params: { status: 'PENDING' } })).data,
    enabled,
  });
}

export function useRefunds(enabled = true) {
  return useQuery<Refund[]>({
    queryKey: ['refunds'],
    queryFn: async () => (await apiClient.get('/v1/refunds')).data,
    enabled,
  });
}

export function useAllPricing(enabled = true) {
  return useQuery<Pricing[]>({
    queryKey: ['pricing', 'all'],
    queryFn: async () => (await apiClient.get('/v1/pricing')).data,
    enabled,
  });
}

// ---------------------------------------------------------------------------
// UI bits
// ---------------------------------------------------------------------------

/** Peso amount input: typed in pesos, converted to centavos on submit. */
export const MoneyInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { currency?: string }>(
  function MoneyInput({ currency = 'PHP', ...props }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          {currency === 'PHP' ? '₱' : currency}
        </span>
        <input
          ref={ref}
          inputMode="decimal"
          autoComplete="off"
          className={`w-full rounded-md border border-slate-300 py-2 pr-3 text-sm tabular-nums focus:border-red-600 focus:outline-none disabled:bg-slate-50 ${
            currency === 'PHP' ? 'pl-7' : 'pl-12'
          }`}
          {...props}
        />
      </div>
    );
  },
);

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function NoMatches({ onClear, children }: { onClear?: () => void; children: React.ReactNode }) {
  return (
    <p className="px-4 py-14 text-center text-sm text-slate-500">
      {children}{' '}
      {onClear && (
        <button type="button" onClick={onClear} className="font-medium text-red-700 hover:underline">
          Clear filters
        </button>
      )}
    </p>
  );
}

export function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-medium hover:underline">
          Dismiss
        </button>
      )}
    </div>
  );
}
