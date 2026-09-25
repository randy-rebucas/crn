'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button, Card, ErrorState, PageHeader } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

type Filter = 'all' | 'unread';

// ['notifications'] is shared with the dashboard layout's bell badge, so
// every optimistic update here moves that unread count too.
const QUERY_KEY = ['notifications'];

// Notification types are "<domain>.<event>" (e.g. "payment.verified"); the
// domain picks the icon and tint.
const TYPE_STYLES: Record<string, { icon: React.ReactNode; tone: string }> = {
  payment: { icon: adminIcons.creditCard, tone: 'bg-amber-100 text-amber-700' },
  invoice: { icon: adminIcons.fileText, tone: 'bg-amber-100 text-amber-700' },
  refund: { icon: adminIcons.history, tone: 'bg-amber-100 text-amber-700' },
  certificate: { icon: baseIcons.certificate, tone: 'bg-red-100 text-red-700' },
  enrollment: { icon: adminIcons.userPlus, tone: 'bg-red-100 text-red-700' },
  admission: { icon: adminIcons.clipboardCheck, tone: 'bg-red-100 text-red-700' },
  exam: { icon: baseIcons.exams, tone: 'bg-slate-900 text-white' },
  attempt: { icon: baseIcons.exams, tone: 'bg-slate-900 text-white' },
  class: { icon: baseIcons.schedule, tone: 'bg-slate-100 text-slate-700' },
  schedule: { icon: baseIcons.schedule, tone: 'bg-slate-100 text-slate-700' },
};
const DEFAULT_STYLE = { icon: adminIcons.bell, tone: 'bg-slate-100 text-slate-600' };

function styleFor(type: string) {
  const domain = type.split('.')[0].replace(/s$/, '');
  return TYPE_STYLES[domain] ?? DEFAULT_STYLE;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupLabel(iso: string) {
  const today = startOfDay(new Date());
  const day = startOfDay(new Date(iso));
  const diffDays = Math.round((today - day) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Earlier this week';
  return 'Older';
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 24 * 7) return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const checkAllIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="m3 12.5 4 4 8-9M13 16.5l1 1 8-9" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');

  const notificationsQuery = useQuery<Notification[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => (await apiClient.get('/v1/notifications')).data,
  });

  // Optimistic: the dot and badge clear immediately; a failure rolls back.
  const optimisticRead = async (ids: string[] | 'all') => {
    await queryClient.cancelQueries({ queryKey: QUERY_KEY });
    const previous = queryClient.getQueryData<Notification[]>(QUERY_KEY);
    const now = new Date().toISOString();
    queryClient.setQueryData<Notification[]>(QUERY_KEY, (old) =>
      old?.map((n) => (!n.readAt && (ids === 'all' || ids.includes(n.id)) ? { ...n, readAt: now } : n)),
    );
    return { previous };
  };

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/notifications/${id}/read`),
    onMutate: (id) => optimisticRead([id]),
    onError: (_err, _id, ctx) => queryClient.setQueryData(QUERY_KEY, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiClient.patch('/v1/notifications/read-all'),
    onMutate: () => optimisticRead('all'),
    onError: (_err, _vars, ctx) => queryClient.setQueryData(QUERY_KEY, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const all = useMemo(
    () => (notificationsQuery.data ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [notificationsQuery.data],
  );
  const unreadCount = all.filter((n) => !n.readAt).length;
  const visible = filter === 'unread' ? all.filter((n) => !n.readAt) : all;

  const groups = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const n of visible) {
      const label = groupLabel(n.createdAt);
      map.set(label, [...(map.get(label) ?? []), n]);
    }
    return Array.from(map.entries());
  }, [visible]);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: all.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={
          notificationsQuery.data
            ? unreadCount > 0
              ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}.`
              : 'You’re all caught up.'
            : 'Updates about payments, enrollments, exams and certificates.'
        }
        action={
          unreadCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="inline-flex shrink-0 items-center gap-1.5"
            >
              {checkAllIcon}
              Mark all as read
            </Button>
          )
        }
      />

      {(markRead.isError || markAllRead.isError) && (
        <div className="mb-4">
          <ErrorState message="Couldn't mark that as read. Check your connection and try again." />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter notifications">
            {tabs.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                    active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 tabular-nums ${active ? 'text-red-100' : 'text-slate-400'}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {notificationsQuery.isLoading && (
          <ul className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex gap-3 px-4 py-4">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {notificationsQuery.isError && (
          <div className="p-4">
            <ErrorState message="Couldn't load your notifications. Refresh the page to try again." />
          </div>
        )}

        {notificationsQuery.data && visible.length === 0 && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              {adminIcons.bell}
            </span>
            <p className="text-sm font-medium text-slate-900">
              {filter === 'unread' && all.length > 0 ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              {filter === 'unread' && all.length > 0
                ? 'You’ve read everything. Switch to All to see past updates.'
                : 'Payment verifications, issued certificates and other updates will show up here.'}
            </p>
          </div>
        )}

        {groups.map(([label, items]) => (
          <section key={label} aria-labelledby={`group-${label}`}>
            <h2
              id={`group-${label}`}
              className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500"
            >
              {label}
            </h2>
            <ul className="divide-y divide-slate-100">
              {items.map((n) => {
                const unread = !n.readAt;
                const style = styleFor(n.type);
                return (
                  <li key={n.id} className={`group relative flex gap-3 px-4 py-4 transition-colors ${unread ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px] ${style.tone}`}
                      aria-hidden="true"
                    >
                      {style.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {unread && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </p>
                        <time
                          dateTime={n.createdAt}
                          title={new Date(n.createdAt).toLocaleString()}
                          className="shrink-0 pt-0.5 text-xs tabular-nums text-slate-400"
                        >
                          {timeLabel(n.createdAt)}
                        </time>
                      </div>
                      {n.body && (
                        <p className={`mt-0.5 text-sm ${unread ? 'text-slate-700' : 'text-slate-500'}`}>{n.body}</p>
                      )}
                      {unread && (
                        <button
                          type="button"
                          onClick={() => markRead.mutate(n.id)}
                          className="mt-2 rounded text-xs font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                    {unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-700" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </Card>
    </div>
  );
}
