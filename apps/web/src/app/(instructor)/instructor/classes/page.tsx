'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui';

interface ClassRecord {
  id: string;
  name: string;
  course: { name: string; code: string };
  batch: { id: string; name: string };
  room: { name: string } | null;
  instructor: { user: { id: string; firstName: string; lastName: string } } | null;
}

export default function InstructorClassesPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });

  const myClasses = useMemo(
    () => (data ?? []).filter((cls) => cls.instructor?.user.id === user?.id),
    [data, user?.id],
  );

  return (
    <div>
      <PageHeader title="My Classes" description="Sections you're assigned to teach." />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load classes." />}
      {!isLoading && !isError && myClasses.length === 0 && (
        <EmptyState title="No classes assigned" description="You aren't assigned to teach any class sections yet." />
      )}

      {!isLoading && myClasses.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myClasses.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{cls.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {cls.course.name} ({cls.course.code})
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cls.batch.name}</td>
                  <td className="px-4 py-3 text-slate-600">{cls.room?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
