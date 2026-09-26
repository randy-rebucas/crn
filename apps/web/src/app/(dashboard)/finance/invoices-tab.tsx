'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Drawer, EmptyState, ErrorState, Field, Input, Select, StatusBadge } from '@/components/ui';
import {
  type Enrollment,
  FilterChips,
  FormError,
  type Invoice,
  MoneyInput,
  NoMatches,
  SearchBox,
  TableSkeleton,
  dueLabel,
  errorMessage,
  humanize,
  isOverdue,
  money,
  outstandingOf,
  paidOf,
  personName,
  refundedOf,
  shortDate,
  toCents,
  useAllPricing,
  useInvoices,
} from './finance-shared';
import { RecordPaymentForm } from './record-payment-form';

type InvoiceFilter = 'all' | 'open' | 'overdue' | 'PAID' | 'CANCELLED';

// ---------------------------------------------------------------------------
// Create

function CreateInvoiceForm({ invoices, onDone }: { invoices: Invoice[]; onDone: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const enrollmentsQuery = useQuery<Enrollment[]>({
    queryKey: ['enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
  });
  const pricingQuery = useAllPricing(hasPermission('pricing.view'));
  const settingsQuery = useQuery<{ invoiceDueDays: number | null }>({
    queryKey: ['settings'],
    queryFn: async () => (await apiClient.get('/v1/settings')).data,
    enabled: hasPermission('settings.view'),
  });

  const invoiced = new Set(invoices.filter((i) => i.status !== 'CANCELLED').map((i) => i.enrollmentId));
  const eligible = (enrollmentsQuery.data ?? []).filter(
    (e) => !invoiced.has(e.id) && !['CANCELLED', 'REJECTED', 'DRAFT'].includes(e.status),
  );
  const activePrice = new Map(
    (pricingQuery.data ?? []).filter((p) => p.isActive).map((p) => [p.programId, p] as const),
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ enrollmentId: string; discount: string; dueDate: string }>({
    defaultValues: { enrollmentId: '', discount: '', dueDate: '' },
  });
  const enrollmentId = useWatch({ control, name: 'enrollmentId' });
  const discount = useWatch({ control, name: 'discount' });
  const selected = eligible.find((e) => e.id === enrollmentId);
  const price = selected?.program ? activePrice.get(selected.program.id) : undefined;
  const discountCents = discount ? toCents(discount) : 0;
  const dueDays = settingsQuery.data?.invoiceDueDays;

  const onSubmit = async (values: { enrollmentId: string; discount: string; dueDate: string }) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/invoices', {
        enrollmentId: values.enrollmentId,
        discountAmount: values.discount ? toCents(values.discount) : undefined,
        dueDate: values.dueDate || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the invoice. Check the details and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field label="Enrollment" error={errors.enrollmentId?.message}>
        <Select {...register('enrollmentId', { required: 'Choose who this invoice is for' })} disabled={enrollmentsQuery.isLoading}>
          <option value="">{enrollmentsQuery.isLoading ? 'Loading enrollments…' : 'Select an enrollment…'}</option>
          {eligible.map((e) => (
            <option key={e.id} value={e.id}>
              {personName(e.student.user)} · {e.program?.name ?? 'No program'}
            </option>
          ))}
        </Select>
      </Field>
      {enrollmentsQuery.isError && (
        <p className="-mt-3 text-xs text-red-700">Couldn&apos;t load enrollments. You may need the enrollments.view permission.</p>
      )}
      {enrollmentsQuery.data && eligible.length === 0 && (
        <p className="-mt-3 text-xs text-slate-500">Every active enrollment already has an invoice.</p>
      )}

      {selected && (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          {price ? (
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-slate-500">Program price</dt>
                <dd className="tabular-nums text-slate-900">{money(price.amount, price.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Discount</dt>
                <dd className="tabular-nums text-slate-900">
                  {Number.isNaN(discountCents) ? '—' : `− ${money(discountCents, price.currency)}`}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold">
                <dt className="text-slate-900">Invoice total</dt>
                <dd className="tabular-nums text-slate-900">
                  {Number.isNaN(discountCents) ? '—' : money(Math.max(price.amount - discountCents, 0), price.currency)}
                </dd>
              </div>
            </dl>
          ) : hasPermission('pricing.view') && pricingQuery.data ? (
            <p className="text-red-700">
              {selected.program?.name ?? 'This program'} has no active price. Set one under Pricing before invoicing.
            </p>
          ) : (
            <p className="text-slate-500">The invoice uses the program&apos;s current active price.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Discount" error={errors.discount?.message}>
          <MoneyInput
            placeholder="0.00"
            {...register('discount', {
              validate: (v) => {
                if (!v) return true;
                const cents = toCents(v);
                if (Number.isNaN(cents)) return 'Enter an amount like 1500 or 1,500.00';
                if (price && cents > price.amount) return 'Discount is more than the price';
                return true;
              },
            })}
          />
        </Field>
        <Field label="Due date">
          <Input type="date" {...register('dueDate')} />
        </Field>
      </div>
      <p className="-mt-3 text-xs text-slate-500">
        {dueDays != null
          ? `Leave the due date empty to use the default of ${dueDays} day${dueDays === 1 ? '' : 's'} from today.`
          : 'Leave the due date empty for no due date.'}
      </p>

      <FormError message={serverError} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || eligible.length === 0}>
          {isSubmitting ? 'Creating…' : 'Create invoice'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// List

export function InvoicesTab({ createOpen, onCloseCreate }: { createOpen: boolean; onCloseCreate: () => void }) {
  const { hasPermission } = useAuth();
  const { data, isLoading, isError } = useInvoices();
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const invoices = useMemo(() => data ?? [], [data]);
  const canPay = hasPermission('payments.create');

  const counts: Record<InvoiceFilter, number> = {
    all: invoices.length,
    open: invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length,
    overdue: invoices.filter(isOverdue).length,
    PAID: invoices.filter((i) => i.status === 'PAID').length,
    CANCELLED: invoices.filter((i) => i.status === 'CANCELLED').length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'open' && (i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID')) ||
        (filter === 'overdue' && isOverdue(i)) ||
        i.status === filter;
      const haystack = `${personName(i.enrollment?.student.user)} ${i.enrollment?.program?.name ?? ''} ${i.id}`.toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [invoices, filter, search]);

  return (
    <>
      <Drawer open={createOpen} onClose={onCloseCreate} title="New invoice">
        {createOpen && <CreateInvoiceForm invoices={invoices} onDone={onCloseCreate} />}
      </Drawer>
      <Drawer open={payingId !== null} onClose={() => setPayingId(null)} title="Record payment">
        {payingId && <RecordPaymentForm key={payingId} invoices={invoices} initialInvoiceId={payingId} onDone={() => setPayingId(null)} />}
      </Drawer>

      {isError && <ErrorState message="Couldn't load invoices. Refresh the page to try again." />}
      {data && invoices.length === 0 && (
        <EmptyState title="No invoices yet" description="Create an invoice once a reviewee's enrollment is approved." />
      )}

      {(isLoading || invoices.length > 0) && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips
              label="Filter invoices"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: counts.all },
                { id: 'open', label: 'Open', count: counts.open },
                { id: 'overdue', label: 'Overdue', count: counts.overdue, alert: true },
                { id: 'PAID', label: 'Paid', count: counts.PAID },
                ...(counts.CANCELLED ? [{ id: 'CANCELLED' as const, label: 'Cancelled', count: counts.CANCELLED }] : []),
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search student or program" />
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : visible.length === 0 ? (
            <NoMatches
              onClear={() => {
                setFilter('all');
                setSearch('');
              }}
            >
              No invoices match.
            </NoMatches>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Student</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                    <th scope="col" className="w-48 px-4 py-3 font-medium">Paid</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                    <th scope="col" className="px-4 py-3 font-medium">Due</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((inv) => {
                    const paid = paidOf(inv);
                    const balance = outstandingOf(inv);
                    const pct = inv.totalAmount > 0 ? Math.min(100, Math.round((paid / inv.totalAmount) * 100)) : 0;
                    const overdue = isOverdue(inv);
                    const expanded = expandedId === inv.id;
                    const pending = inv.payments.filter((p) => p.status === 'PENDING').length;
                    return (
                      <Fragment key={inv.id}>
                        <tr className={`transition-colors hover:bg-slate-50 ${overdue ? 'bg-red-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{personName(inv.enrollment?.student.user)}</p>
                            <p className="text-xs text-slate-500">
                              {inv.enrollment?.program?.name ?? 'Program'}
                              <span className="ml-1.5 font-mono text-[11px] text-slate-400">#{inv.id.slice(0, 8)}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                            {money(inv.totalAmount)}
                            {inv.discountAmount > 0 && (
                              <p className="text-[11px] text-slate-400">{money(inv.discountAmount)} off</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-9 text-right text-xs tabular-nums text-slate-600">{pct}%</span>
                            </div>
                            {refundedOf(inv) > 0 && (
                              <p className="mt-1 text-[11px] text-slate-500">{money(refundedOf(inv))} refunded</p>
                            )}
                            {pending > 0 && (
                              <p className="mt-1 text-[11px] text-amber-700">
                                {pending} payment{pending === 1 ? '' : 's'} awaiting verification
                              </p>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium tabular-nums ${balance > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                            {money(balance)}
                          </td>
                          <td className="px-4 py-3">
                            {inv.dueDate ? (
                              <>
                                <p className="tabular-nums text-slate-700">{shortDate(inv.dueDate)}</p>
                                {balance > 0 && (
                                  <p className={`text-xs ${overdue ? 'font-medium text-red-700' : 'text-slate-500'}`}>{dueLabel(inv.dueDate)}</p>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">No due date</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {canPay && balance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPayingId(inv.id)}
                                  className="rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                                >
                                  Record payment
                                </button>
                              )}
                              <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setExpandedId(expanded ? null : inv.id)}
                                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                              >
                                {expanded ? 'Hide' : `Payments${inv.payments.length ? ` (${inv.payments.length})` : ''}`}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50 px-4 py-4">
                              {inv.payments.length === 0 ? (
                                <p className="text-sm text-slate-500">No payments recorded against this invoice yet.</p>
                              ) : (
                                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                                  {inv.payments.map((p) => (
                                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                                      <span className="w-28 font-medium tabular-nums text-slate-900">{money(p.amount)}</span>
                                      <span className="w-28 text-slate-600">{humanize(p.method)}</span>
                                      <span className="w-28 text-slate-500">{shortDate(p.createdAt)}</span>
                                      <StatusBadge status={p.status} />
                                      {p.receipt && (
                                        <span className="ml-auto font-mono text-xs text-slate-500">{p.receipt.receiptNumber}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
