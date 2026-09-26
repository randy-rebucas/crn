'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { apiClient } from '@/lib/api-client';
import { Button, Field, Select } from '@/components/ui';
import {
  FormError,
  type Invoice,
  MoneyInput,
  PAYMENT_METHODS,
  centsToInput,
  errorMessage,
  humanize,
  money,
  outstandingOf,
  personName,
  toCents,
} from './finance-shared';

interface Values {
  invoiceId: string;
  amount: string;
  method: (typeof PAYMENT_METHODS)[number];
}

// Payments already recorded but not yet verified. They don't count toward
// the invoice's paid amount, but they will once verified, so a new payment
// can only cover what's left after them (the API enforces the same rule).
function pendingOf(inv: Invoice) {
  return inv.payments.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
}

function payableOf(inv: Invoice) {
  return Math.max(outstandingOf(inv) - pendingOf(inv), 0);
}

// Records a PENDING payment; a cashier with payments.verify confirms it
// afterwards, which is what issues the receipt and moves the invoice status.
export function RecordPaymentForm({
  invoices,
  initialInvoiceId,
  onDone,
}: {
  invoices: Invoice[];
  initialInvoiceId?: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const payable = invoices.filter((inv) => payableOf(inv) > 0);
  const coveredByPending = invoices.some((inv) => outstandingOf(inv) > 0 && payableOf(inv) === 0);
  const initial = invoices.find((inv) => inv.id === initialInvoiceId);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      invoiceId: initialInvoiceId ?? '',
      amount: initial && payableOf(initial) > 0 ? centsToInput(payableOf(initial)) : '',
      method: 'CASH',
    },
  });

  const invoiceId = useWatch({ control, name: 'invoiceId' });
  const selected = invoices.find((inv) => inv.id === invoiceId);
  const outstanding = selected ? outstandingOf(selected) : 0;
  const pendingAmount = selected ? pendingOf(selected) : 0;
  const balance = selected ? payableOf(selected) : 0;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/payments', {
        invoiceId: values.invoiceId,
        amount: toCents(values.amount),
        method: values.method,
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not record the payment. Check the details and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field label="Invoice" error={errors.invoiceId?.message}>
        <Select
          {...register('invoiceId', {
            required: 'Choose the invoice being paid',
            onChange: (e) => {
              const inv = invoices.find((i) => i.id === e.target.value);
              if (inv) setValue('amount', centsToInput(payableOf(inv)));
            },
          })}
        >
          <option value="">Select an invoice…</option>
          {payable.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {personName(inv.enrollment?.student.user)} · {inv.enrollment?.program?.name ?? 'Program'} · {money(payableOf(inv))} due
            </option>
          ))}
        </Select>
      </Field>
      {payable.length === 0 && (
        <p className="-mt-3 text-xs text-slate-500">
          {coveredByPending
            ? 'Every open balance is already covered by payments waiting for verification.'
            : 'Every invoice is fully paid.'}
        </p>
      )}
      {selected && payableOf(selected) === 0 && outstanding > 0 && (
        <p className="-mt-3 text-xs text-amber-800">
          Payments waiting for verification already cover this balance. Verify or reject them first.
        </p>
      )}

      {selected && (
        <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 py-3 text-center text-xs">
          <div>
            <dt className="text-slate-500">Invoice total</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{money(selected.totalAmount)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Paid</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">{money(selected.totalAmount - outstanding)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Balance</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-red-700">{money(outstanding)}</dd>
            {pendingAmount > 0 && <dd className="text-[11px] text-amber-700">{money(pendingAmount)} pending</dd>}
          </div>
        </dl>
      )}

      <div>
        <Field label="Amount received" error={errors.amount?.message}>
          <MoneyInput
            placeholder="0.00"
            {...register('amount', {
              validate: (v) => {
                const cents = toCents(v);
                if (Number.isNaN(cents) || cents <= 0) return 'Enter an amount like 5000 or 5,000.50';
                if (selected && cents > balance) {
                  return pendingAmount > 0
                    ? `Only ${money(balance)} is left once the ${money(pendingAmount)} already pending is verified`
                    : `That's more than the ${money(balance)} balance`;
                }
                return true;
              },
            })}
          />
        </Field>
        {selected && balance > 0 && (
          <button
            type="button"
            onClick={() => setValue('amount', centsToInput(balance), { shouldValidate: true })}
            className="mt-1.5 text-xs font-medium text-red-700 hover:underline"
          >
            Use full balance ({money(balance)})
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Method</legend>
        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 has-[:checked]:border-red-700 has-[:checked]:bg-red-50 has-[:checked]:text-red-800 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-red-600"
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={field.name}
                    value={m}
                    checked={field.value === m}
                    onChange={() => field.onChange(m)}
                  />
                  {humanize(m)}
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        The payment is saved as pending. It counts toward the invoice and gets a receipt once someone verifies it.
      </p>

      <FormError message={serverError} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || payable.length === 0}>
          {isSubmitting ? 'Saving…' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
