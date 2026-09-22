'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card, PageHeader } from '@/components/ui';

const SHORTCUTS: { label: string; href: string; permission: string; description: string }[] = [
  { label: 'Students', href: '/students', permission: 'students.view', description: 'View and manage student records' },
  { label: 'Enrollments', href: '/enrollments', permission: 'enrollments.view', description: 'Move applications through the pipeline' },
  { label: 'Programs', href: '/programs', permission: 'programs.view', description: 'Manage review programs and courses' },
  { label: 'Reports', href: '/reports', permission: 'reports.view', description: 'Enrollment, revenue, and exam performance' },
];

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const visible = SHORTCUTS.filter((s) => hasPermission(s.permission));

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.email ?? ''}`}
        description={`Roles: ${user?.roles.join(', ') || 'none'}`}
      />

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">Your account has no dashboard sections enabled yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="p-5 transition hover:border-red-300 hover:shadow-md">
                <div className="text-sm font-semibold text-slate-900">{s.label}</div>
                <div className="mt-1 text-xs text-slate-500">{s.description}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
