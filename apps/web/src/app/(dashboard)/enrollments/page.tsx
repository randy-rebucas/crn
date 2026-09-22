'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, Select, StatusBadge } from '@/components/ui';

interface Enrollment {
  id: string;
  status: string;
  createdAt: string;
  student: { id: string; user: { firstName: string; lastName: string; email: string } };
  program: { id: string; name: string };
  batch: { id: string; name: string } | null;
}

// Mirrors the server's ENROLLMENT_TRANSITIONS map (apps/api/src/modules/enrollments/enrollment-transitions.ts)
// purely so the dropdown only offers moves that will actually succeed — the
// API re-validates every transition regardless, this is UX only.
const NEXT_STATUSES: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['REQUIREMENTS_INCOMPLETE', 'APPROVED', 'REJECTED'],
  REQUIREMENTS_INCOMPLETE: ['UNDER_REVIEW', 'CANCELLED'],
  APPROVED: ['PAYMENT_PENDING'],
  PAYMENT_PENDING: ['PAYMENT_VERIFIED', 'CANCELLED'],
  PAYMENT_VERIFIED: ['ENROLLED'],
  ENROLLED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export default function EnrollmentsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<Enrollment[]>({
    queryKey: ['enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/v1/enrollments/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
  });

  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Applications moving through the enrollment pipeline, scoped to your branch access."
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load enrollments." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No enrollments visible" description="No enrollments match your current access scope." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Status</th>
                {hasPermission('enrollments.update') && <th className="px-4 py-3 text-right">Move to</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((enrollment) => {
                const nextOptions = NEXT_STATUSES[enrollment.status] ?? [];
                return (
                  <tr key={enrollment.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {enrollment.student.user.firstName} {enrollment.student.user.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{enrollment.student.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{enrollment.program.name}</td>
                    <td className="px-4 py-3 text-slate-600">{enrollment.batch?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={enrollment.status} />
                    </td>
                    {hasPermission('enrollments.update') && (
                      <td className="px-4 py-3 text-right">
                        {nextOptions.length > 0 ? (
                          <Select
                            defaultValue=""
                            disabled={transition.isPending}
                            onChange={(e) => {
                              if (e.target.value) {
                                transition.mutate({ id: enrollment.id, status: e.target.value });
                              }
                            }}
                          >
                            <option value="" disabled>
                              Choose status…
                            </option>
                            {nextOptions.map((status) => (
                              <option key={status} value={status}>
                                {status.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs text-slate-400">Final</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
