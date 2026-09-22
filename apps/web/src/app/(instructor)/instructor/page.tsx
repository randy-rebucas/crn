'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card, PageHeader } from '@/components/ui';

const SHORTCUTS: { label: string; href: string; permission: string; description: string }[] = [
  { label: 'My Classes', href: '/classes', permission: 'classes.view', description: "Today's sessions and rosters" },
  { label: 'Attendance', href: '/attendance', permission: 'attendance.view', description: 'Mark and review attendance' },
  { label: 'Grading', href: '/exams', permission: 'exams.grade', description: 'Score attempts awaiting review' },
];

export default function InstructorHomePage() {
  const { user, hasPermission } = useAuth();
  const visible = SHORTCUTS.filter((s) => hasPermission(s.permission));

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.email ?? ''}`}
        description={`Roles: ${user?.roles.join(', ') || 'none'}`}
      />

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No instructor sections are enabled for your account yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="p-5 transition hover:border-indigo-300 hover:shadow-md">
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
