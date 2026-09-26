'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, PageHeader } from '@/components/ui';
import { adminIcons } from '@/components/admin-shell';
import {
  isOverdue,
  money,
  moneyCompact,
  outstandingOf,
  paidOf,
  useInvoices,
  usePendingPayments,
  useRefunds,
} from './finance-shared';
import { InvoicesTab } from './invoices-tab';
import { PaymentsTab } from './payments-tab';
import { PricingTab } from './pricing-tab';
import { RefundsTab } from './refunds-tab';

type TabKey = 'invoices' | 'payments' | 'refunds' | 'pricing';

const TABS: { key: TabKey; label: string; view: string; create: string; createLabel: string; icon: React.ReactNode }[] = [
  { key: 'invoices', label: 'Invoices', view: 'invoices.view', create: 'invoices.create', createLabel: 'New invoice', icon: adminIcons.fileText },
  { key: 'payments', label: 'Payments', view: 'payments.view', create: 'payments.create', createLabel: 'Record payment', icon: adminIcons.creditCard },
  { key: 'refunds', label: 'Refunds', view: 'refunds.view', create: 'refunds.create', createLabel: 'Request refund', icon: adminIcons.history },
  { key: 'pricing', label: 'Pricing', view: 'pricing.view', create: 'pricing.create', createLabel: 'Set price', icon: adminIcons.layers },
];

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

function Tile({
  icon,
  tone,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 text-left">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </div>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:bg-red-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
    >
      {body}
    </button>
  ) : (
    <Card className="flex items-center gap-4 p-5">{body}</Card>
  );
}

export default function FinancePage() {
  const { hasPermission } = useAuth();
  const tabs = TABS.filter((t) => hasPermission(t.view));
  const [tab, setTab] = useState<TabKey | null>(null);
  const activeTab = tab ?? tabs[0]?.key ?? 'invoices';
  const [createOpen, setCreateOpen] = useState(false);

  const canInvoices = hasPermission('invoices.view');
  const canPayments = hasPermission('payments.view');
  const invoicesQuery = useInvoices(canInvoices);
  const pendingQuery = usePendingPayments(canPayments);
  const refundsQuery = useRefunds(hasPermission('refunds.view'));

  const invoices = (invoicesQuery.data ?? []).filter((i) => i.status !== 'CANCELLED');
  const invoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const collected = invoices.reduce((s, i) => s + paidOf(i), 0);
  const open = invoices.filter((i) => outstandingOf(i) > 0);
  const outstanding = open.reduce((s, i) => s + outstandingOf(i), 0);
  const overdue = invoices.filter(isOverdue);
  const overdueAmount = overdue.reduce((s, i) => s + outstandingOf(i), 0);
  const pending = pendingQuery.data ?? [];
  const pendingAmount = pending.reduce((s, p) => s + p.amount, 0);
  const openRefunds = (refundsQuery.data ?? []).filter((r) => !['PROCESSED', 'REJECTED'].includes(r.status)).length;

  const badges: Partial<Record<TabKey, { count: number; alert?: boolean }>> = {
    invoices: { count: overdue.length, alert: true },
    payments: { count: pending.length, alert: true },
    refunds: { count: openRefunds },
  };

  const current = TABS.find((t) => t.key === activeTab)!;
  const canCreate = hasPermission(current.create);

  const goTo = (key: TabKey) => {
    if (hasPermission(TABS.find((t) => t.key === key)!.view)) setTab(key);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Invoices, payments, refunds and program prices. Invoice status is always worked out by the server from verified payments."
        action={
          canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="inline-flex shrink-0 items-center gap-1.5">
              {plusIcon}
              {current.createLabel}
            </Button>
          )
        }
      />

      {(canInvoices || canPayments) && (
        <section aria-label="Finance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {canInvoices && (
            <Tile
              icon={adminIcons.creditCard}
              tone="bg-emerald-600 text-white"
              label="Collected"
              value={invoicesQuery.isLoading ? '…' : moneyCompact(collected)}
              detail={invoiced > 0 ? `${Math.round((collected / invoiced) * 100)}% of ${moneyCompact(invoiced)} invoiced` : 'Nothing invoiced yet'}
            />
          )}
          {canInvoices && (
            <Tile
              icon={adminIcons.fileText}
              tone="bg-slate-900 text-white"
              label="Outstanding"
              value={invoicesQuery.isLoading ? '…' : moneyCompact(outstanding)}
              detail={`${open.length} open invoice${open.length === 1 ? '' : 's'}`}
              onClick={() => goTo('invoices')}
            />
          )}
          {canPayments && (
            <Tile
              icon={adminIcons.checkSquare}
              tone={pending.length > 0 ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-600'}
              label="Waiting for verification"
              value={pendingQuery.isLoading ? '…' : String(pending.length)}
              detail={pending.length > 0 ? `${money(pendingAmount)} recorded, not yet verified` : 'All payments verified'}
              onClick={() => goTo('payments')}
            />
          )}
          {canInvoices && (
            <Tile
              icon={adminIcons.history}
              tone={overdue.length > 0 ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-600'}
              label="Overdue"
              value={invoicesQuery.isLoading ? '…' : String(overdue.length)}
              detail={overdue.length > 0 ? `${money(overdueAmount)} past due` : 'Nothing past due'}
              onClick={() => goTo('invoices')}
            />
          )}
        </section>
      )}

      {tabs.length === 0 ? (
        <p className="text-sm text-slate-500">Your account doesn&apos;t have access to any finance records.</p>
      ) : (
        <div>
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Finance sections">
            {tabs.map((t) => {
              const active = activeTab === t.key;
              const badge = badges[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(t.key);
                    setCreateOpen(false);
                  }}
                  className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-red-600 [&_svg]:h-4 [&_svg]:w-4 ${
                    active ? 'border-red-700 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.icon}
                  {t.label}
                  {badge && badge.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                        badge.alert ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {badge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" aria-label={current.label}>
            {activeTab === 'invoices' && <InvoicesTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}
            {activeTab === 'payments' && <PaymentsTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}
            {activeTab === 'refunds' && <RefundsTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}
            {activeTab === 'pricing' && <PricingTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />}
          </div>
        </div>
      )}
    </div>
  );
}
