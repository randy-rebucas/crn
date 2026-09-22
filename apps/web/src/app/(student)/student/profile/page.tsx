'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useMyEnrollments, useMyStudentProfile } from '@/lib/student-hooks';
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader, SectionLabel } from '@/components/student-ui';

interface Certificate {
  id: string;
  studentId: string;
  programId: string;
  certificateNumber: string;
  qrToken: string;
  issuedAt: string;
}

export default function StudentProfilePage() {
  const { logout } = useAuth();
  const router = useRouter();
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();

  // GET /v1/certificates is organization-wide with no studentId filter
  // server-side (`certificates.service.findAllForOrganization`) — filtered
  // client-side to this student's own certificates.
  const certificates = useQuery<Certificate[]>({
    queryKey: ['my-certificates', profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async () => {
      const { data } = await apiClient.get<Certificate[]>('/v1/certificates');
      return data.filter((c) => c.studentId === profile.data!.id);
    },
  });

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <StudentShell>
      <StudentPageHeader title="Profile" />

      {profile.isLoading && <LoadingState />}
      {profile.isError && <ErrorState message="Could not load your profile." />}

      {profile.data && (
        <Card className="p-4">
          <div className="text-base font-semibold text-slate-900">
            {profile.data.user.firstName} {profile.data.user.lastName}
          </div>
          <div className="mt-1 text-sm text-slate-500">{profile.data.user.email}</div>
          {profile.data.user.phone && <div className="text-sm text-slate-500">{profile.data.user.phone}</div>}
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
            {profile.data.dateOfBirth && (
              <div>
                <dt className="text-xs text-slate-500">Date of birth</dt>
                <dd className="text-slate-800">{new Date(profile.data.dateOfBirth).toLocaleDateString()}</dd>
              </div>
            )}
            {profile.data.address && (
              <div>
                <dt className="text-xs text-slate-500">Address</dt>
                <dd className="text-slate-800">{profile.data.address}</dd>
              </div>
            )}
            {profile.data.emergencyContactName && (
              <div>
                <dt className="text-xs text-slate-500">Emergency contact</dt>
                <dd className="text-slate-800">
                  {profile.data.emergencyContactName}
                  {profile.data.emergencyContactPhone ? ` · ${profile.data.emergencyContactPhone}` : ''}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <SectionLabel>Enrollments</SectionLabel>
      {enrollments.isLoading && <LoadingState />}
      {enrollments.isError && <ErrorState message="Could not load enrollments." />}
      {enrollments.data && enrollments.data.length === 0 && (
        <EmptyState title="No enrollments" description="You haven't enrolled in a program yet." />
      )}
      {enrollments.data && enrollments.data.length > 0 && (
        <div className="space-y-2">
          {enrollments.data.map((e) => (
            <Card key={e.id} className="flex items-center justify-between p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{e.program.name}</div>
                <div className="text-xs text-slate-500">{e.batch?.name ?? 'No batch assigned'}</div>
              </div>
              <StatusBadge status={e.status} />
            </Card>
          ))}
        </div>
      )}

      <SectionLabel>Certificates</SectionLabel>
      {certificates.isLoading && <LoadingState />}
      {certificates.isError && <ErrorState message="Could not load certificates." />}
      {certificates.data && certificates.data.length === 0 && (
        <EmptyState title="No certificates yet" description="Certificates you earn will appear here." />
      )}
      {certificates.data && certificates.data.length > 0 && (
        <div className="space-y-2">
          {certificates.data.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-900">{c.certificateNumber}</div>
                <div className="text-xs text-slate-500">{new Date(c.issuedAt).toLocaleDateString()}</div>
              </div>
              {/* Public verification endpoint: GET /v1/certificates/verify/:qrToken
                  (no auth required) — anyone with the QR link/token can confirm
                  authenticity. Surfacing the raw verify link here so the
                  student can share/print it alongside their certificate. */}
              <div className="mt-1 truncate text-xs text-slate-400">
                Verify: /v1/certificates/verify/{c.qrToken}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button variant="secondary" className="mt-6 w-full" onClick={handleLogout}>
        Sign out
      </Button>
    </StudentShell>
  );
}
