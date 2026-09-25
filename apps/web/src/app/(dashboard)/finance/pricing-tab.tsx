'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Drawer, EmptyState, ErrorState, Field, Select } from '@/components/ui';
import {
  FormError,
  MoneyInput,
  type Pricing,
  type Program,
  SearchBox,
  TableSkeleton,
  centsToInput,
  errorMessage,
  money,
  shortDate,
  toCents,
  useAllPricing,
} from './finance-shared';

function SetPriceForm({
  programs,
  current,
  initialProgramId,
  onDone,
}: {
  programs: Program[];
  current: Map<string, Pricing>;
  initialProgramId?: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const initialPrice = initialProgramId ? current.get(initialProgramId) : undefined;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ programId: string; amount: string }>({
    defaultValues: { programId: initialProgramId ?? '', amount: initialPrice ? centsToInput(initialPrice.amount) : '' },
  });
  const existing = current.get(useWatch({ control, name: 'programId' }));

  const onSubmit = async (values: { programId: string; amount: string }) => {
    setServerError(null);
    try {
      // Currency left to the server: it applies Settings > Finance > Default currency.
      await apiClient.post('/v1/pricing', { programId: values.programId, amount: toCents(values.amount) });
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save the price.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field label="Program" error={errors.programId?.message}>
        <Select {...register('programId', { required: 'Choose a program' })}>
          <option value="">Select a program…</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="New price" error={errors.amount?.message}>
        <MoneyInput
          placeholder="15,000.00"
          currency={existing?.currency ?? 'PHP'}
          {...register('amount', {
            validate: (v) => {
              const cents = toCents(v);
              return (!Number.isNaN(cents) && cents > 0) || 'Enter a price like 15000 or 15,000.00';
            },
          })}
        />
      </Field>
      {existing && (
        <p className="-mt-3 text-xs text-slate-500">
          Replaces the current {money(existing.amount, existing.currency)}. Invoices already issued keep their original amount.
        </p>
      )}
      <FormError message={serverError} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save price'}
        </Button>
      </div>
    </form>
  );
}

export function PricingTab({ createOpen, onCloseCreate }: { createOpen: boolean; onCloseCreate: () => void }) {
  const { hasPermission } = useAuth();
  const canSet = hasPermission('pricing.create');
  const programsQuery = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });
  const pricingQuery = useAllPricing();
  const [search, setSearch] = useState('');
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const history = useMemo(() => {
    const map = new Map<string, Pricing[]>();
    for (const p of pricingQuery.data ?? []) map.set(p.programId, [...(map.get(p.programId) ?? []), p]);
    return map;
  }, [pricingQuery.data]);
  const current = useMemo(
    () => new Map((pricingQuery.data ?? []).filter((p) => p.isActive).map((p) => [p.programId, p] as const)),
    [pricingQuery.data],
  );

  // Programs come from /v1/programs when visible; otherwise fall back to the
  // program names embedded in the pricing rows.
  const programs = useMemo(() => {
    if (programsQuery.data) return programsQuery.data;
    const seen = new Map<string, Program>();
    for (const p of pricingQuery.data ?? []) if (p.program) seen.set(p.program.id, p.program);
    return Array.from(seen.values());
  }, [programsQuery.data, pricingQuery.data]);

  const visible = programs
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(current.has(a.id)) - Number(current.has(b.id)) || a.name.localeCompare(b.name));
  const unpriced = programs.filter((p) => !current.has(p.id)).length;
  const drawerOpen = createOpen || editingProgramId !== null;
  const closeDrawer = () => {
    setEditingProgramId(null);
    onCloseCreate();
  };

  const isLoading = pricingQuery.isLoading || programsQuery.isLoading;

  return (
    <>
      <Drawer open={drawerOpen} onClose={closeDrawer} title={editingProgramId ? 'Change price' : 'Set program price'}>
        {drawerOpen && (
          <SetPriceForm
            key={editingProgramId ?? 'new'}
            programs={programs}
            current={current}
            initialProgramId={editingProgramId ?? undefined}
            onDone={closeDrawer}
          />
        )}
      </Drawer>

      {pricingQuery.isError && <ErrorState message="Couldn't load prices. Refresh the page to try again." />}
      {!isLoading && programs.length === 0 && !pricingQuery.isError && (
        <EmptyState title="No programs yet" description="Create a program first, then give it a price here." />
      )}

      {(isLoading || programs.length > 0) && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {unpriced > 0 ? (
                <span className="font-medium text-red-700">
                  {unpriced} program{unpriced === 1 ? ' has' : 's have'} no price and can&apos;t be invoiced yet.
                </span>
              ) : (
                'Every program has an active price.'
              )}
            </p>
            <SearchBox value={search} onChange={setSearch} placeholder="Search programs" />
          </div>
          {isLoading ? (
            <TableSkeleton rows={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Program</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Current price</th>
                    <th scope="col" className="px-4 py-3 font-medium">Change</th>
                    <th scope="col" className="px-4 py-3 font-medium">Since</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((program) => {
                    const price = current.get(program.id);
                    const past = (history.get(program.id) ?? []).filter((p) => !p.isActive);
                    const previous = past[0];
                    const change =
                      price && previous && previous.amount > 0 ? Math.round(((price.amount - previous.amount) / previous.amount) * 100) : null;
                    const expanded = expandedId === program.id;
                    return (
                      <Fragment key={program.id}>
                        <tr className={`transition-colors hover:bg-slate-50 ${price ? '' : 'bg-red-50/40'}`}>
                          <td className="px-4 py-3 font-medium text-slate-900">{program.name}</td>
                          <td className="px-4 py-3 text-right">
                            {price ? (
                              <span className="font-semibold tabular-nums text-slate-900">{money(price.amount, price.currency)}</span>
                            ) : (
                              <span className="text-xs font-medium text-red-700">No price set</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {change === null ? (
                              <span className="text-xs text-slate-400">{price ? 'First price' : '—'}</span>
                            ) : (
                              <span className={`text-xs font-medium ${change > 0 ? 'text-amber-700' : change < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {change > 0 ? '+' : ''}
                                {change}% from {money(previous!.amount, previous!.currency)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">{price ? shortDate(price.createdAt) : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {canSet && (
                                <button
                                  type="button"
                                  onClick={() => setEditingProgramId(program.id)}
                                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                                    price ? 'border border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-red-700 text-white hover:bg-red-800'
                                  }`}
                                >
                                  {price ? 'Change price' : 'Set price'}
                                </button>
                              )}
                              {past.length > 0 && (
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  onClick={() => setExpandedId(expanded ? null : program.id)}
                                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  {expanded ? 'Hide history' : `History (${past.length})`}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={5} className="bg-slate-50 px-4 py-3">
                              <ul className="space-y-1 text-sm">
                                {past.map((p) => (
                                  <li key={p.id} className="flex gap-4 text-slate-600">
                                    <span className="w-32 tabular-nums">{shortDate(p.createdAt)}</span>
                                    <span className="tabular-nums line-through decoration-slate-300">{money(p.amount, p.currency)}</span>
                                  </li>
                                ))}
                              </ul>
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
