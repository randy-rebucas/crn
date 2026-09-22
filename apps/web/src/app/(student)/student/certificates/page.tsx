'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useMyStudentProfile } from '@/lib/student-hooks';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { StudentShell, StudentPageHeader } from '@/components/student-ui';

interface Certificate {
  id: string;
  studentId: string;
  programId: string;
  certificateNumber: string;
  qrToken: string;
  issuedAt: string;
}

// GET /v1/certificates is organization-wide with no studentId filter
// server-side (`certificates.service.findAllForOrganization`) — filtered
// client-side to this student's own certificates, same as before this was
// split out of the profile page into its own sidebar destination.
export default function StudentCertificatesPage() {
  const profile = useMyStudentProfile();

  const certificates = useQuery<Certificate[]>({
    queryKey: ['my-certificates', profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async () => {
      const { data } = await apiClient.get<Certificate[]>('/v1/certificates');
      return data.filter((c) => c.studentId === profile.data!.id);
    },
  });

  return (
    <StudentShell>
      <StudentPageHeader title="Certificates" description="Certificates you've earned across your programs." />

      {(profile.isLoading || certificates.isLoading) && <LoadingState />}
      {(profile.isError || certificates.isError) && <ErrorState message="Could not load your certificates." />}

      {certificates.data && certificates.data.length === 0 && (
        <EmptyState title="No certificates yet" description="Certificates you earn will appear here." />
      )}

      {certificates.data && certificates.data.length > 0 && (
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
          {certificates.data.map((c) => (
            <Card key={c.id} className="p-4">
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
    </StudentShell>
  );
}
