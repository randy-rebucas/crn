'use client';

import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { StudentShell, StudentPageHeader } from '@/components/student-ui';
import { useMarkNotificationRead, useMyNotifications } from '@/lib/student-hooks';

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function StudentNotificationsPage() {
  const notifications = useMyNotifications();
  const markRead = useMarkNotificationRead();

  const items = notifications.data?.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) ?? [];

  return (
    <StudentShell>
      <StudentPageHeader title="Notifications" description="Updates about your classes, exams, and enrollment." />

      {notifications.isLoading && <LoadingState />}
      {notifications.isError && <ErrorState message="Could not load notifications." />}
      {notifications.data && items.length === 0 && (
        <EmptyState title="No notifications yet" description="You're all caught up." />
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={n.readAt ? '' : 'border-red-200 bg-red-50/40'}>
              <button
                type="button"
                disabled={Boolean(n.readAt)}
                onClick={() => markRead.mutate(n.id)}
                className="w-full p-3 text-left"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-red-700" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{n.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
