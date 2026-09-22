'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

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

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await apiClient.get('/v1/notifications')).data,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = notificationsQuery.data?.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) ?? [];

  return (
    <div>
      <PageHeader title="Notifications" description="Your own in-app notifications." />

      {notificationsQuery.isLoading && <LoadingState />}
      {notificationsQuery.isError && <ErrorState message="Could not load notifications." />}
      {notificationsQuery.data && items.length === 0 && (
        <EmptyState title="No notifications yet" description="You're all caught up." />
      )}

      {items.length > 0 && (
        <div className="max-w-2xl space-y-2">
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
    </div>
  );
}
