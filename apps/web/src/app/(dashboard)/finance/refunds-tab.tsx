'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Drawer, EmptyState, ErrorState, Field, Select, StatusBadge, Textarea } from '@/components/ui';
import {
  FilterChips,
  FormError,
  InlineAlert,
  MoneyInput,
  NoMatches,
  type Refund,
  SearchBox,
  TableSkeleton,
  centsToInput,
  errorMessage,
  humanize,
  money,
  personName,
  shortDate,
  toCents,
  useAllPayments,
  useRefunds,
} from './finance-shared';

// Approval chain (blueprint Section 25): officer → manager → processed. The
// two approvals are deliberately separate permissions held by different roles.
const STEPS = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'OFFICER_APPROVED', label: 'Officer' },
  { status: 'APPROVED', label: 'Manager' },
  { status: 'PROCESSED', label: 'Paid out' },
] as const;

function Stepper({ status }: { status: string }) {
  if (status === 'REJECTED') return <StatusBadge status="REJECTED" />;
  const reached = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-1" aria-label={`Refund progress: ${humanize(status)}`}>
      {STEPS.map((step, i) => {
        const done = i <= reached;
        return (
          <li key={step.status} className="flex items-center gap-1">
            {i > 0 && <span className={`h-px w-3 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} aria-hidden="true" />}
            <span
              title={step.label}
              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
              } ${i === reached + 1 ? 'ring-1 ring-amber-300' : ''}`}
            >
              {done ? (
                <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" aria-hidden="true">
                  <path d="m2.5 6.2 2.2 2.2L9.5 3.6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RequestRefundForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { data: payments, isLoading } = useAllPayments();
  const verified = (payments ?? []).filter((p) => p.status === 'VERIFIED');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<{ paymentId: string; amount: string; reason: string }>({
    defaultValues: { paymentId: '', amount: '', reason: '' },
  });
  const paymentId = useWatch({ control, name: 'paymentId' });
  const selected = verified.find((p) => p.id === paymentId);

  const onSubmit = async (values: { paymentId: string; amount: string; reason: string }) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/refunds', {
        paymentId: values.paymentId,
        amount: toCents(values.amount),
        reason: values.reason.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not submit the refund request.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field label="Verified payment" error={errors.paymentId?.message}>
        <Select
          {...register('paymentId', {
            required: 'Choose the payment to refund',
            onChange: (e) => {
              const p = verified.find((x) => x.id === e.target.value);
              if (p) setValue('amount', centsToInput(p.amount));
            },
          })}
          disabled={isLoading}
        >
          <option value="">{isLoading ? 'Loading payments…' : 'Select a payment…'}</option>
          {verified.map((p) => (
            <option key={p.id} value={p.id}>
              {personName(p.invoice?.enrollment.student.user)} · {money(p.amount)} {humanize(p.method)}
              {p.receipt ? ` · ${p.receipt.receiptNumber}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Refund amount" error={errors.amount?.message}>
        <MoneyInput
          placeholder="0.00"
          {...register('amount', {
            validate: (v) => {
              const cents = toCents(v);
              if (Number.isNaN(cents) || cents <= 0) return 'Enter an amount like 2500 or 2,500.00';
              if (selected && cents > selected.amount) return `Can't refund more than the ${money(selected.amount)} paid`;
              return true;
            },
          })}
        />
      </Field>
      <Field label="Reason" error={errors.reason?.message}>
        <Textarea
          rows={3}
          placeholder="Why is this being refunded? The approvers will see this."
          {...register('reason', { validate: (v) => v.trim().length > 0 || 'Give a reason for the approvers' })}
        />
      </Field>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        After you submit, a finance officer and then a manager must approve before the refund can be paid out.
      </p>
      <FormError message={serverError} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || verified.length === 0}>
          {isSubmitting ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </form>
  );
}

type RefundFilter = 'action' | 'open' | 'done' | 'all';

export function RefundsTab({ createOpen, onCloseCreate }: { createOpen: boolean; onCloseCreate: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useRefunds();
  const [search, setSearch] = useState('');
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refunds = useMemo(() => data ?? [], [data]);

  // What the current user can do with a refund at its current step.
  const actionsFor = (r: Refund) => {
    const actions: { key: 'officer' | 'manager' | 'process'; label: string }[] = [];
    if (r.status === 'REQUESTED' && hasPermission('refunds.officer_approve')) actions.push({ key: 'officer', label: 'Approve as officer' });
    if (r.status === 'OFFICER_APPROVED' && hasPermission('refunds.manager_approve')) actions.push({ key: 'manager', label: 'Approve as manager' });
    if (r.status === 'APPROVED' && hasPermission('refunds.process')) actions.push({ key: 'process', label: 'Mark paid out' });
    // Reject is gated server-side by whichever approval step the refund is on.
    const canReject =
      (r.status === 'REQUESTED' && hasPermission('refunds.officer_approve')) ||
      (r.status === 'OFFICER_APPROVED' && hasPermission('refunds.manager_approve'));
    return { actions, canReject };
  };

  const needsAction = refunds.filter((r) => {
    const { actions, canReject } = actionsFor(r);
    return actions.length > 0 || canReject;
  });
  const [filter, setFilter] = useState<RefundFilter | null>(null);
  const activeFilter: RefundFilter = filter ?? (needsAction.length > 0 ? 'action' : 'all');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['refunds'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };
  const act = useMutation({
    mutationFn: ({ id, key }: { id: string; key: 'officer' | 'manager' | 'process' | 'reject' }) => {
      const path = { officer: 'officer-approve', manager: 'manager-approve', process: 'process', reject: 'reject' }[key];
      return apiClient.patch(`/v1/refunds/${id}/${path}`);
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setConfirmRejectId(null);
      refresh();
    },
    onError: (err) => setActionError(errorMessage(err, 'That action could not be completed.')),
  });

  const counts: Record<RefundFilter, number> = {
    action: needsAction.length,
    open: refunds.filter((r) => !['PROCESSED', 'REJECTED'].includes(r.status)).length,
    done: refunds.filter((r) => ['PROCESSED', 'REJECTED'].includes(r.status)).length,
    all: refunds.length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const actionIds = new Set(needsAction.map((r) => r.id));
    return refunds.filter((r) => {
      const inFilter =
        activeFilter === 'all' ||
        (activeFilter === 'action' && actionIds.has(r.id)) ||
        (activeFilter === 'open' && !['PROCESSED', 'REJECTED'].includes(r.status)) ||
        (activeFilter === 'done' && ['PROCESSED', 'REJECTED'].includes(r.status));
      const haystack = `${personName(r.payment?.invoice.enrollment.student.user)} ${r.reason} ${r.payment?.receipt?.receiptNumber ?? ''}`.toLowerCase();
      return inFilter && (!q || haystack.includes(q));
    });
  }, [refunds, needsAction, activeFilter, search]);

  return (
    <>
      <Drawer open={createOpen} onClose={onCloseCreate} title="Request refund">
        {createOpen && <RequestRefundForm onDone={onCloseCreate} />}
      </Drawer>

      {isError && <ErrorState message="Couldn't load refunds. Refresh the page to try again." />}
      {data && refunds.length === 0 && (
        <EmptyState title="No refund requests" description="Refunds requested against verified payments will be tracked here." />
      )}

      {(isLoading || refunds.length > 0) && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips
              label="Filter refunds"
              value={activeFilter}
              onChange={setFilter}
              options={[
                { id: 'action', label: 'Needs my action', count: counts.action, tone: 'alert' },
                { id: 'open', label: 'In progress', count: counts.open },
                { id: 'done', label: 'Closed', count: counts.done },
                { id: 'all', label: 'All', count: counts.all },
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search student or reason" />
          </div>

          {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}

          {isLoading ? (
            <TableSkeleton />
          ) : visible.length === 0 ? (
            <NoMatches
              onClear={() => {
                setFilter('all');
                setSearch('');
              }}
            >
              {activeFilter === 'action' && !search ? 'Nothing is waiting on you.' : 'No refunds match.'}
            </NoMatches>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((r) => {
                const { actions, canReject } = actionsFor(r);
                const confirming = confirmRejectId === r.id;
                const busy = act.isPending && act.variables?.id === r.id;
                return (
                  <li key={r.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="font-medium text-slate-900">{personName(r.payment?.invoice.enrollment.student.user)}</p>
                        <p className="font-semibold tabular-nums text-slate-900">{money(r.amount)}</p>
                        {r.payment && (
                          <p className="text-xs text-slate-500">
                            of {money(r.payment.amount)} {humanize(r.payment.method)}
                            {r.payment.receipt && <span className="ml-1 font-mono">· {r.payment.receipt.receiptNumber}</span>}
                          </p>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">“{r.reason}”</p>
                      <p className="mt-1 text-xs text-slate-400">Requested {shortDate(r.createdAt)}</p>
                    </div>
                    <div className="shrink-0">
                      <Stepper status={r.status} />
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5 lg:w-72">
                      {confirming ? (
                        <>
                          <span className="self-center text-xs text-slate-600">Reject this refund?</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => act.mutate({ id: r.id, key: 'reject' })}
                            className="rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                          >
                            Yes, reject
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRejectId(null)}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {actions.map((a) => (
                            <button
                              key={a.key}
                              type="button"
                              disabled={busy}
                              onClick={() => act.mutate({ id: r.id, key: a.key })}
                              className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                            >
                              {busy ? 'Saving…' : a.label}
                            </button>
                          ))}
                          {canReject && (
                            <button
                              type="button"
                              onClick={() => setConfirmRejectId(r.id)}
                              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                            >
                              Reject
                            </button>
                          )}
                          {actions.length === 0 && !canReject && !['PROCESSED', 'REJECTED'].includes(r.status) && (
                            <span className="text-xs text-slate-400">Waiting on another approver</span>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
