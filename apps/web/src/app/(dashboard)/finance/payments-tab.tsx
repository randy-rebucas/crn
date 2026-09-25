'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, Drawer, EmptyState, ErrorState, StatusBadge } from '@/components/ui';
import {
  FilterChips,
  InlineAlert,
  NoMatches,
  SearchBox,
  TableSkeleton,
  errorMessage,
  humanize,
  money,
  personName,
  shortDate,
  useAllPayments,
  useInvoices,
} from './finance-shared';
import { RecordPaymentForm } from './record-payment-form';

type PaymentFilter = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'all';

export function PaymentsTab({ createOpen, onCloseCreate }: { createOpen: boolean; onCloseCreate: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useAllPayments();
  const invoicesQuery = useInvoices(hasPermission('invoices.view'));
  const canVerify = hasPermission('payments.verify');

  const payments = useMemo(() => data ?? [], [data]);
  const pendingCount = payments.filter((p) => p.status === 'PENDING').length;
  const [filter, setFilter] = useState<PaymentFilter | null>(null);
  // Land on the verification queue when there's something in it.
  const activeFilter: PaymentFilter = filter ?? (pendingCount > 0 ? 'PENDING' : 'all');
  const [search, setSearch] = useState('');
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const verify = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/payments/${id}/verify`),
    onMutate: () => setActionError(null),
    onSuccess: refresh,
    onError: (err) => setActionError(errorMessage(err, 'Could not verify that payment.')),
  });
  const reject = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/payments/${id}/reject`),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setConfirmRejectId(null);
      refresh();
    },
    onError: (err) => setActionError(errorMessage(err, 'Could not reject that payment.')),
  });

  const counts: Record<PaymentFilter, number> = {
    PENDING: pendingCount,
    VERIFIED: payments.filter((p) => p.status === 'VERIFIED').length,
    REJECTED: payments.filter((p) => p.status === 'REJECTED').length,
    all: payments.length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const haystack = `${personName(p.invoice?.enrollment.student.user)} ${p.receipt?.receiptNumber ?? ''} ${p.method}`.toLowerCase();
      return (activeFilter === 'all' || p.status === activeFilter) && (!q || haystack.includes(q));
    });
  }, [payments, activeFilter, search]);

  return (
    <>
      <Drawer open={createOpen} onClose={onCloseCreate} title="Record payment">
        {createOpen &&
          (invoicesQuery.data ? (
            <RecordPaymentForm invoices={invoicesQuery.data} onDone={onCloseCreate} />
          ) : invoicesQuery.isError || !hasPermission('invoices.view') ? (
            <ErrorState message="Recording a payment needs access to invoices (invoices.view)." />
          ) : (
            <TableSkeleton rows={4} />
          ))}
      </Drawer>

      {isError && <ErrorState message="Couldn't load payments. Refresh the page to try again." />}
      {data && payments.length === 0 && (
        <EmptyState title="No payments yet" description="Payments recorded against invoices will appear here for verification." />
      )}

      {(isLoading || payments.length > 0) && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips
              label="Filter payments"
              value={activeFilter}
              onChange={setFilter}
              options={[
                { id: 'PENDING', label: 'To verify', count: counts.PENDING, tone: 'alert' },
                { id: 'VERIFIED', label: 'Verified', count: counts.VERIFIED },
                { id: 'REJECTED', label: 'Rejected', count: counts.REJECTED },
                { id: 'all', label: 'All', count: counts.all },
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search student or receipt" />
          </div>

          {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}

          {isLoading ? (
            <TableSkeleton />
          ) : visible.length === 0 ? (
            <NoMatches
              onClear={
                search || filter
                  ? () => {
                      setSearch('');
                      setFilter('all');
                    }
                  : undefined
              }
            >
              {activeFilter === 'PENDING' && !search ? 'Nothing waiting for verification.' : 'No payments match.'}
            </NoMatches>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Student</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                    <th scope="col" className="px-4 py-3 font-medium">Method</th>
                    <th scope="col" className="px-4 py-3 font-medium">Recorded</th>
                    <th scope="col" className="px-4 py-3 font-medium">Receipt</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    {canVerify && (
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => {
                    const pending = p.status === 'PENDING';
                    const confirming = confirmRejectId === p.id;
                    return (
                      <tr key={p.id} className={`transition-colors hover:bg-slate-50 ${pending ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{personName(p.invoice?.enrollment.student.user)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{money(p.amount)}</td>
                        <td className="px-4 py-3 text-slate-600">{humanize(p.method)}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">{shortDate(p.createdAt)}</td>
                        <td className="px-4 py-3">
                          {p.receipt ? (
                            <span className="font-mono text-xs text-slate-600">{p.receipt.receiptNumber}</span>
                          ) : (
                            <span className="text-xs text-slate-400">{pending ? 'Issued on verify' : '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        {canVerify && (
                          <td className="px-4 py-3">
                            {pending && (
                              <div className="flex justify-end gap-1.5">
                                {confirming ? (
                                  <>
                                    <span className="self-center text-xs text-slate-600">Reject this payment?</span>
                                    <button
                                      type="button"
                                      disabled={reject.isPending}
                                      onClick={() => reject.mutate(p.id)}
                                      className="rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                                    >
                                      {reject.isPending ? 'Rejecting…' : 'Yes, reject'}
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
                                    <button
                                      type="button"
                                      disabled={verify.isPending}
                                      onClick={() => verify.mutate(p.id)}
                                      className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"
                                    >
                                      {verify.isPending && verify.variables === p.id ? 'Verifying…' : 'Verify'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmRejectId(p.id)}
                                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && data.length >= 200 && (
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">Showing the 200 most recent payments.</p>
          )}
        </Card>
      )}
    </>
  );
}
