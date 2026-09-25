'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  type Notification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
} from '@/lib/student-hooks';
import {
  HeroFigure,
  Panel,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
} from '@/components/student-ui';

// GET /v1/notifications is self-scoped and polled every minute (see
// useMyNotifications). Today the API emits `enrollment.<status>`,
// `payment.verified`, and `certificate.issued`; anything else falls back to
// keyword matching on type + title, then to "Announcements".

type CategoryKey = 'enrollment' | 'payments' | 'certificates' | 'exams' | 'classes' | 'announcements';

const CATEGORIES: Record<CategoryKey, { label: string; icon: React.ReactNode; tone: string; link?: { href: string; label: string } }> = {
  enrollment: {
    label: 'Enrollment',
    icon: icons.profile,
    tone: 'bg-violet-50 text-violet-700',
    link: { href: '/student/certificates', label: 'See your progress' },
  },
  payments: {
    label: 'Payments',
    icon: icons.quiz,
    tone: 'bg-emerald-50 text-emerald-700',
    link: { href: '/student/certificates', label: 'See your progress' },
  },
  certificates: {
    label: 'Certificates',
    icon: icons.certificate,
    tone: 'bg-amber-50 text-amber-700',
    link: { href: '/student/certificates', label: 'View certificate' },
  },
  exams: {
    label: 'Exams',
    icon: icons.exams,
    tone: 'bg-red-50 text-red-700',
    link: { href: '/student/progress', label: 'See results' },
  },
  classes: {
    label: 'Classes',
    icon: icons.schedule,
    tone: 'bg-blue-50 text-blue-700',
    link: { href: '/student/schedule', label: 'Open schedule' },
  },
  announcements: { label: 'Announcements', icon: icons.megaphone, tone: 'bg-slate-100 text-slate-700' },
};
const CATEGORY_ORDER: CategoryKey[] = ['enrollment', 'payments', 'certificates', 'exams', 'classes', 'announcements'];

function categoryOf(n: Notification): CategoryKey {
  const type = n.type.toLowerCase();
  if (type.startsWith('enrollment.')) return 'enrollment';
  if (type.startsWith('payment.')) return 'payments';
  if (type.startsWith('certificate.')) return 'certificates';
  const t = `${type} ${n.title}`.toLowerCase();
  if (t.includes('exam') || t.includes('result') || t.includes('grade')) return 'exams';
  if (t.includes('schedule') || t.includes('class')) return 'classes';
  if (t.includes('enroll')) return 'enrollment';
  if (t.includes('payment')) return 'payments';
  if (t.includes('certificate')) return 'certificates';
  return 'announcements';
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function bucketOf(iso: string, now: Date): string {
  const day = startOfDay(new Date(iso));
  const today = startOfDay(now);
  if (day >= today) return 'Today';
  if (day >= today - DAY_MS) return 'Yesterday';
  if (day >= today - 6 * DAY_MS) return 'Earlier this week';
  return 'Earlier';
}
const BUCKETS = ['Today', 'Yesterday', 'Earlier this week', 'Earlier'];

// ---------------------------------------------------------------------------
// One notification
// ---------------------------------------------------------------------------

function NotificationRow({ n, now, onRead, pending }: { n: Notification; now: number; onRead: () => void; pending: boolean }) {
  const cat = CATEGORIES[categoryOf(n)];
  const unread = !n.readAt;

  return (
    <li className={`flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 ${unread ? 'bg-red-50/40' : ''}`}>
      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cat.tone}`}>
        {cat.icon}
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-600 ring-2 ring-white">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className={`text-sm leading-snug ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</p>
          <time dateTime={n.createdAt} className="shrink-0 text-[11px] tabular-nums text-slate-500" title={new Date(n.createdAt).toLocaleString()}>
            {timeAgo(n.createdAt, now)}
          </time>
        </div>
        {n.body && <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-slate-600">{n.body}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {cat.icon}
            {cat.label}
          </span>
          {cat.link && (
            <Link
              href={cat.link.href}
              onClick={() => unread && onRead()}
              className="inline-flex items-center gap-1 rounded font-semibold text-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              {cat.link.label}
              {icons.arrowRight}
            </Link>
          )}
          {unread && (
            <button
              type="button"
              onClick={onRead}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
            >
              Mark as read
              <span className="sr-only">: {n.title}</span>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Rail: notices per category, each row a filter
// ---------------------------------------------------------------------------

function ByCategory({
  items,
  selected,
  onSelect,
}: {
  items: Notification[];
  selected: CategoryKey | null;
  onSelect: (key: CategoryKey | null) => void;
}) {
  const rows = CATEGORY_ORDER.map((key) => {
    const list = items.filter((n) => categoryOf(n) === key);
    return { key, total: list.length, unread: list.filter((n) => !n.readAt).length };
  }).filter((r) => r.total > 0);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <Panel title="By Category" icon={icons.progress}>
      <ul className="space-y-1" role="group" aria-label="Filter notifications by category">
        {rows.map((r) => {
          const cat = CATEGORIES[r.key];
          const active = selected === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : r.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-red-700 ${
                  active ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px] ${cat.tone}`}>{cat.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={`truncate ${active ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{cat.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {r.unread > 0 && <span className="font-semibold text-red-700">{r.unread} new · </span>}
                      <span className="font-semibold text-slate-900">{r.total}</span>
                    </span>
                  </span>
                  <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100" style={{ width: `${Math.max(10, (r.total / max) * 100)}%` }} aria-hidden>
                    <span className="h-full bg-red-600" style={{ width: `${(r.unread / r.total) * 100}%` }} />
                    <span className="h-full flex-1 bg-slate-400" />
                  </span>
                </span>
                <span className="sr-only">
                  {`${r.total} notifications, ${r.unread} unread.`} {active ? 'Showing only this category.' : 'Show only this category.'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-red-600" aria-hidden /> Unread
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm bg-slate-400" aria-hidden /> Read
        </span>
        <span className="text-slate-400">Tap a category to filter.</span>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StudentNotificationsPage() {
  const [now] = useState(() => new Date());
  const notifications = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<CategoryKey | null>(null);

  const items = useMemo(
    () => (notifications.data ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [notifications.data],
  );
  const unreadCount = items.filter((n) => !n.readAt).length;
  const weekCount = items.filter((n) => now.getTime() - new Date(n.createdAt).getTime() < 7 * DAY_MS).length;
  const shown = items.filter((n) => (!unreadOnly || !n.readAt) && (!category || categoryOf(n) === category));
  const groups = BUCKETS.map((b) => ({ bucket: b, list: shown.filter((n) => bucketOf(n.createdAt, now) === b) })).filter((g) => g.list.length > 0);
  const filtering = unreadOnly || Boolean(category);
  const dash = <span className="text-slate-300">—</span>;
  const ready = Boolean(notifications.data);

  return (
    <StudentShell>
      <StudentPageHero badge={icons.bell} title="Notifications" meta={<span>Updates about your classes, exams, and enrollment.</span>}>
        <HeroFigure icon={icons.bell} tone="bg-red-50 text-red-700" value={ready ? unreadCount : dash} label="Unread" />
        <HeroFigure icon={icons.sparkle} tone="bg-amber-50 text-amber-700" value={ready ? weekCount : dash} label="This week" />
        <HeroFigure icon={icons.megaphone} tone="bg-blue-50 text-blue-700" value={ready ? items.length : dash} label="All notifications" />
        <HeroFigure
          icon={icons.schedule}
          tone="bg-emerald-50 text-emerald-700"
          value={items[0] ? timeAgo(items[0].createdAt, now.getTime()) : dash}
          label="Latest update"
        />
      </StudentPageHero>

      {notifications.isLoading && <SkeletonRows count={4} className="h-20" />}
      {notifications.isError && <PanelMessage tone="error">Couldn&apos;t load your notifications. Refresh the page to try again.</PanelMessage>}
      {ready && items.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.bell}</span>
          <span className="font-semibold text-slate-700">No notifications yet</span>
          <span>Enrollment, payment, and certificate updates will show up here.</span>
        </PanelMessage>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Show">
                {[
                  { key: false, label: 'All', count: items.length },
                  { key: true, label: 'Unread', count: unreadCount },
                ].map((t) => {
                  const selected = unreadOnly === t.key;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setUnreadOnly(t.key)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                        selected ? 'bg-red-700 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className={`tabular-nums text-xs ${selected ? 'text-red-100' : 'text-slate-400'}`}>{t.count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {category && (
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-800 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  >
                    {CATEGORIES[category].label}
                    <span className="[&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
                      {icons.close}
                    </span>
                    <span className="sr-only">(clear category filter)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={unreadCount === 0 || markAll.isPending}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-emerald-600 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
                    {icons.quiz}
                  </span>
                  {markAll.isPending ? 'Marking…' : 'Mark all as read'}
                </button>
              </div>
            </div>

            {markAll.isError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                Couldn&apos;t mark everything as read. Try again.
              </p>
            )}
            <p className="sr-only" aria-live="polite">
              {filtering ? `${shown.length} of ${items.length} notifications shown` : ''}
            </p>

            {shown.length === 0 ? (
              <PanelMessage>
                <span className="text-emerald-600 [&_svg]:h-8 [&_svg]:w-8">{icons.quiz}</span>
                <span className="font-semibold text-slate-700">{unreadOnly ? 'You’re all caught up' : 'Nothing here'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setUnreadOnly(false);
                    setCategory(null);
                  }}
                  className="font-semibold text-red-700 underline underline-offset-4"
                >
                  Show all notifications
                </button>
              </PanelMessage>
            ) : (
              <div className="space-y-6">
                {groups.map((g) => (
                  <section key={g.bucket} aria-labelledby={`notif-${g.bucket}`}>
                    <h2 id={`notif-${g.bucket}`} className="mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold text-slate-900">
                      {g.bucket}
                      <span className="text-xs font-normal text-slate-400">· {g.list.length}</span>
                    </h2>
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
                      {g.list.map((n) => (
                        <NotificationRow
                          key={n.id}
                          n={n}
                          now={now.getTime()}
                          onRead={() => markRead.mutate(n.id)}
                          pending={markRead.isPending && markRead.variables === n.id}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-20" aria-label="Notification overview">
            <ByCategory items={items} selected={category} onSelect={setCategory} />
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
