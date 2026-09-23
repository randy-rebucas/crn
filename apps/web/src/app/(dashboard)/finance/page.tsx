'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

// ---------------------------------------------------------------------------
// Shared types (mirrors apps/api Prisma models — see schema.prisma)
// ---------------------------------------------------------------------------

interface Program {
  id: string;
  name: string;
}

interface Pricing {
  id: string;
  programId: string;
  amount: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

interface Enrollment {
  id: string;
  student: { user: { firstName: string; lastName: string } };
  program: { id: string; name: string };
}

interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  receipt?: { receiptNumber: string } | null;
  invoice?: { id: string; enrollment: { student: { user: { firstName: string; lastName: string } } } };
}

interface Invoice {
  id: string;
  enrollmentId: string;
  amount: number;
  discountAmount: number;
  totalAmount: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  payments: Payment[];
}

interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  requestedById: string;
  approvedById: string | null;
  processedAt: string | null;
  createdAt: string;
}

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD', 'GCASH', 'OTHER'] as const;

function formatMoney(amountInCents: number, currency = 'PHP') {
  return `${currency} ${(amountInCents / 100).toFixed(2)}`;
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

const createPricingSchema = z.object({
  programId: z.string().min(1, 'Required'),
  amount: z.coerce.number().int().positive('Must be a positive amount'),
  currency: z.string().optional(),
});
type CreatePricingValues = z.input<typeof createPricingSchema>;
type CreatePricingOutput = z.output<typeof createPricingSchema>;

function PricingSection() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: programs } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });

  const { data: pricing, isLoading, isError } = useQuery<Pricing[]>({
    queryKey: ['pricing', selectedProgramId],
    queryFn: async () => (await apiClient.get('/v1/pricing', { params: { programId: selectedProgramId } })).data,
    enabled: Boolean(selectedProgramId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePricingValues, unknown, CreatePricingOutput>({ resolver: zodResolver(createPricingSchema) });

  const onSubmit = async (values: CreatePricingOutput) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/pricing', {
        programId: values.programId,
        amount: values.amount,
        currency: values.currency || undefined,
      });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create pricing entry.'));
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="w-64">
          <Field label="Program">
            <Select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}>
              <option value="">Select a program…</option>
              {programs?.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {hasPermission('pricing.create') && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Price'}</Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Set program price">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Program" error={errors.programId?.message}>
            <Select {...register('programId')} defaultValue={selectedProgramId}>
              <option value="">Select…</option>
              {programs?.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (centavos)" error={errors.amount?.message}>
            <Input type="number" placeholder="e.g. 1500000 = PHP 15,000.00" {...register('amount')} />
          </Field>
          <Field label="Currency">
            <Input placeholder="PHP" {...register('currency')} />
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save price'}
            </Button>
          </div>
        </form>
      </Drawer>

      {!selectedProgramId && (
        <EmptyState title="Choose a program" description="Select a program above to view its pricing history." />
      )}
      {selectedProgramId && isLoading && <LoadingState />}
      {selectedProgramId && isError && <ErrorState message="Could not load pricing." />}
      {selectedProgramId && !isLoading && !isError && pricing?.length === 0 && (
        <EmptyState title="No pricing set" description="This program has no price entries yet." />
      )}
      {selectedProgramId && pricing && pricing.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Set on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pricing.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.currency}</td>
                  <td className="px-4 py-3">
                    {p.isActive ? <StatusBadge status="ACTIVE" /> : <span className="text-xs text-slate-400">Superseded</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const createInvoiceSchema = z.object({
  enrollmentId: z.string().min(1, 'Required'),
  discountAmount: z.coerce.number().int().min(0).optional(),
  dueDate: z.string().optional(),
});
type CreateInvoiceValues = z.input<typeof createInvoiceSchema>;
type CreateInvoiceOutput = z.output<typeof createInvoiceSchema>;

function InvoicesSection() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: enrollments } = useQuery<Enrollment[]>({
    queryKey: ['enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
  });

  const { data: invoices, isLoading, isError } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => (await apiClient.get('/v1/invoices')).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvoiceValues, unknown, CreateInvoiceOutput>({ resolver: zodResolver(createInvoiceSchema) });

  const onSubmit = async (values: CreateInvoiceOutput) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/invoices', {
        enrollmentId: values.enrollmentId,
        discountAmount: values.discountAmount,
        dueDate: values.dueDate || undefined,
      });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create invoice.'));
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {hasPermission('invoices.create') && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Invoice'}</Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New invoice">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Enrollment" error={errors.enrollmentId?.message}>
            <Select {...register('enrollmentId')}>
              <option value="">Select…</option>
              {enrollments?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.student.user.firstName} {e.student.user.lastName} — {e.program.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Discount (centavos)" error={errors.discountAmount?.message}>
            <Input type="number" placeholder="Optional" {...register('discountAmount')} />
          </Field>
          <Field label="Due date">
            <Input type="date" {...register('dueDate')} />
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create invoice'}
            </Button>
          </div>
        </form>
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load invoices." />}
      {!isLoading && !isError && invoices?.length === 0 && (
        <EmptyState title="No invoices yet" description="Create an invoice from a paid-pending enrollment." />
      )}
      {!isLoading && invoices && invoices.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => {
                const paid = invoice.payments
                  .filter((p) => p.status === 'VERIFIED')
                  .reduce((sum, p) => sum + p.amount, 0);
                const outstanding = Math.max(invoice.totalAmount - paid, 0);
                const expanded = expandedId === invoice.id;
                return (
                  <Fragment key={invoice.id}>
                    <tr>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{invoice.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(invoice.totalAmount)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatMoney(outstanding)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" onClick={() => setExpandedId(expanded ? null : invoice.id)}>
                          {expanded ? 'Hide' : 'Details'}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Linked payments
                          </div>
                          {invoice.payments.length === 0 ? (
                            <p className="mt-1 text-sm text-slate-500">No payments recorded yet.</p>
                          ) : (
                            <ul className="mt-2 space-y-1">
                              {invoice.payments.map((p) => (
                                <li key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                                  <StatusBadge status={p.status} />
                                  <span>{formatMoney(p.amount)}</span>
                                  <span className="text-slate-400">via {p.method}</span>
                                  {p.receipt && (
                                    <span className="text-xs text-slate-400">({p.receipt.receiptNumber})</span>
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
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Required'),
  amount: z.coerce.number().int().positive('Must be a positive amount'),
  method: z.enum(PAYMENT_METHODS),
});
type CreatePaymentValues = z.input<typeof createPaymentSchema>;
type CreatePaymentOutput = z.output<typeof createPaymentSchema>;

function PaymentsSection() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => (await apiClient.get('/v1/invoices')).data,
  });

  const { data: payments, isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['payments', invoiceFilter],
    queryFn: async () => (await apiClient.get('/v1/payments', { params: { invoiceId: invoiceFilter } })).data,
    enabled: Boolean(invoiceFilter),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePaymentValues, unknown, CreatePaymentOutput>({ resolver: zodResolver(createPaymentSchema) });

  const onSubmit = async (values: CreatePaymentOutput) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/payments', values);
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not record payment.'));
    }
  };

  const verify = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/payments/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/payments/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="w-72">
          <Field label="Invoice">
            <Select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)}>
              <option value="">Select an invoice…</option>
              {invoices?.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id.slice(0, 8)} — {formatMoney(inv.totalAmount)} ({inv.status})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {hasPermission('payments.create') && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'Record Payment'}</Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Record payment">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Invoice" error={errors.invoiceId?.message}>
            <Select {...register('invoiceId')} defaultValue={invoiceFilter}>
              <option value="">Select…</option>
              {invoices?.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id.slice(0, 8)} — {formatMoney(inv.totalAmount)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (centavos)" error={errors.amount?.message}>
            <Input type="number" {...register('amount')} />
          </Field>
          <Field label="Method" error={errors.method?.message}>
            <Select {...register('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Record payment'}
            </Button>
          </div>
        </form>
      </Drawer>

      {!invoiceFilter && (
        <EmptyState title="Choose an invoice" description="Select an invoice above to view its payments." />
      )}
      {invoiceFilter && isLoading && <LoadingState />}
      {invoiceFilter && isError && <ErrorState message="Could not load payments." />}
      {invoiceFilter && !isLoading && !isError && payments?.length === 0 && (
        <EmptyState title="No payments" description="No payments recorded against this invoice yet." />
      )}
      {invoiceFilter && payments && payments.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recorded</th>
                {hasPermission('payments.verify') && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.method.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                  {hasPermission('payments.verify') && (
                    <td className="px-4 py-3 text-right">
                      {p.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" disabled={verify.isPending} onClick={() => verify.mutate(p.id)}>
                            Verify
                          </Button>
                          <Button variant="danger" disabled={reject.isPending} onClick={() => reject.mutate(p.id)}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

const createRefundSchema = z.object({
  paymentId: z.string().min(1, 'Required'),
  amount: z.coerce.number().int().positive('Must be a positive amount'),
  reason: z.string().min(1, 'Required'),
});
type CreateRefundValues = z.input<typeof createRefundSchema>;
type CreateRefundOutput = z.output<typeof createRefundSchema>;

function RefundsSection() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: refunds, isLoading, isError } = useQuery<Refund[]>({
    queryKey: ['refunds'],
    queryFn: async () => (await apiClient.get('/v1/refunds')).data,
  });

  // Org-wide payments list (no `invoiceId` filter) so the refund form can
  // offer a real picker instead of asking the operator to paste a raw
  // payment id. Only fetched while the form is open, and narrowed to
  // VERIFIED here since that's the only status the API will accept anyway.
  const { data: verifiedPayments } = useQuery<Payment[]>({
    queryKey: ['payments', 'all'],
    queryFn: async () => (await apiClient.get('/v1/payments')).data,
    enabled: showForm,
    select: (data) => data.filter((p) => p.status === 'VERIFIED'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRefundValues, unknown, CreateRefundOutput>({ resolver: zodResolver(createRefundSchema) });

  const onSubmit = async (values: CreateRefundOutput) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/refunds', values);
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not request refund.'));
    }
  };

  const invalidateRefunds = () => {
    queryClient.invalidateQueries({ queryKey: ['refunds'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const officerApprove = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/refunds/${id}/officer-approve`),
    onSuccess: invalidateRefunds,
  });
  const managerApprove = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/refunds/${id}/manager-approve`),
    onSuccess: invalidateRefunds,
  });
  const rejectRefund = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/refunds/${id}/reject`),
    onSuccess: invalidateRefunds,
  });
  const processRefund = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/refunds/${id}/process`),
    onSuccess: invalidateRefunds,
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {hasPermission('refunds.create') && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'Request Refund'}</Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Request refund">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Verified payment" error={errors.paymentId?.message}>
            <Select {...register('paymentId')} defaultValue="">
              <option value="" disabled>
                Select a payment…
              </option>
              {verifiedPayments?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.invoice
                    ? `${p.invoice.enrollment.student.user.firstName} ${p.invoice.enrollment.student.user.lastName} — `
                    : ''}
                  {formatMoney(p.amount)} ({p.method}) · {p.id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (centavos)" error={errors.amount?.message}>
            <Input type="number" {...register('amount')} />
          </Field>
          <Field label="Reason" error={errors.reason?.message}>
            <Input {...register('reason')} />
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Requesting…' : 'Request refund'}
            </Button>
          </div>
        </form>
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load refunds." />}
      {!isLoading && !isError && refunds?.length === 0 && (
        <EmptyState title="No refunds" description="No refund requests have been made yet." />
      )}
      {!isLoading && refunds && refunds.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.paymentId.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(r.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.reason}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {r.status === 'REQUESTED' && hasPermission('refunds.officer_approve') && (
                        <Button
                          variant="ghost"
                          disabled={officerApprove.isPending}
                          onClick={() => officerApprove.mutate(r.id)}
                        >
                          Officer approve
                        </Button>
                      )}
                      {r.status === 'OFFICER_APPROVED' && hasPermission('refunds.manager_approve') && (
                        <Button
                          variant="ghost"
                          disabled={managerApprove.isPending}
                          onClick={() => managerApprove.mutate(r.id)}
                        >
                          Manager approve
                        </Button>
                      )}
                      {/* Reject is gated server-side by whichever step the refund is
                          currently on (officer_approve for REQUESTED, manager_approve
                          for OFFICER_APPROVED) — mirror that here so the button only
                          shows when the action would actually succeed. */}
                      {((r.status === 'REQUESTED' && hasPermission('refunds.officer_approve')) ||
                        (r.status === 'OFFICER_APPROVED' && hasPermission('refunds.manager_approve'))) && (
                        <Button
                          variant="danger"
                          disabled={rejectRefund.isPending}
                          onClick={() => rejectRefund.mutate(r.id)}
                        >
                          Reject
                        </Button>
                      )}
                      {r.status === 'APPROVED' && hasPermission('refunds.process') && (
                        <Button
                          variant="secondary"
                          disabled={processRefund.isPending}
                          onClick={() => processRefund.mutate(r.id)}
                        >
                          Process
                        </Button>
                      )}
                      {['PROCESSED', 'REJECTED'].includes(r.status) && (
                        <span className="text-xs text-slate-400">Final</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'pricing', label: 'Pricing' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'refunds', label: 'Refunds' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function FinancePage() {
  const [tab, setTab] = useState<TabKey>('pricing');

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Program pricing, invoices, payments, and refunds. Invoice status is always computed by the server."
      />

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-red-700 text-red-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pricing' && <PricingSection />}
      {tab === 'invoices' && <InvoicesSection />}
      {tab === 'payments' && <PaymentsSection />}
      {tab === 'refunds' && <RefundsSection />}
    </div>
  );
}
