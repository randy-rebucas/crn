'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Card, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/ui';

interface Enrollment {
  id: string;
  status: string;
  programId: string;
  createdAt: string;
}

interface StudentDetail {
  id: string;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  educationBackground: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; status: string };
  enrollments: Enrollment[];
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery<StudentDetail>({
    queryKey: ['students', params.id],
    queryFn: async () => (await apiClient.get(`/v1/students/${params.id}`)).data,
  });

  return (
    <div>
      <PageHeader
        title={data ? `${data.user.firstName} ${data.user.lastName}` : 'Student'}
        description={data?.user.email}
        action={
          <Link href="/students" className="text-sm text-red-700 hover:underline">
            ← Back to students
          </Link>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load this student." />}

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Profile</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={data.user.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-slate-700">{data.user.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Date of birth</dt>
                <dd className="text-slate-700">
                  {data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Address</dt>
                <dd className="text-slate-700">{data.address ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Emergency contact</dt>
                <dd className="text-slate-700">
                  {data.emergencyContactName ? `${data.emergencyContactName} (${data.emergencyContactPhone ?? '—'})` : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Education background</dt>
                <dd className="text-slate-700">{data.educationBackground ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Joined</dt>
                <dd className="text-slate-700">{new Date(data.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Enrollments</h2>
            {data.enrollments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No enrollments yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-2 text-slate-600">{new Date(e.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
