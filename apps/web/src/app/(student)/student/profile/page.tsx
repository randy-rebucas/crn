'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMyEnrollments, useMyStudentProfile } from '@/lib/student-hooks';
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader, SectionLabel } from '@/components/student-ui';

export default function StudentProfilePage() {
  const { logout } = useAuth();
  const router = useRouter();
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();

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

      <Link
        href="/student/progress"
        className="mt-4 flex min-h-[44px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
      >
        My performance
        <span className="text-slate-400" aria-hidden="true">
          →
        </span>
      </Link>

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

      <Link
        href="/student/certificates"
        className="mt-4 flex min-h-[44px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
      >
        Certificates
        <span className="text-slate-400" aria-hidden="true">
          →
        </span>
      </Link>

      <Button variant="secondary" className="mt-6 w-full" onClick={handleLogout}>
        Sign out
      </Button>
    </StudentShell>
  );
}
