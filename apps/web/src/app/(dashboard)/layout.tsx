'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

// Nav is role-aware, not role-name-aware (blueprint Section 25): each item
// names the permission that unlocks it, and the guard is the same
// `hasPermission` check the API itself enforces — never a hardcoded role
// check like `user.roles.includes('admin')`.
const NAV_ITEMS: { label: string; href: string; permission?: string }[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Students', href: '/students', permission: 'students.view' },
  { label: 'Enrollments', href: '/enrollments', permission: 'enrollments.view' },
  { label: 'Programs', href: '/programs', permission: 'programs.view' },
  { label: 'Courses', href: '/courses', permission: 'courses.view' },
  { label: 'Curriculum', href: '/curriculum', permission: 'courses.view' },
  { label: 'Content', href: '/content', permission: 'content.view' },
  { label: 'Classes', href: '/classes', permission: 'classes.view' },
  { label: 'Schedule', href: '/schedules', permission: 'schedules.view' },
  { label: 'Attendance', href: '/attendance', permission: 'attendance.view' },
  { label: 'Exams', href: '/exams', permission: 'exams.view' },
  { label: 'Results', href: '/results', permission: 'exams.grade' },
  { label: 'Finance', href: '/finance', permission: 'payments.view' },
  { label: 'Leads', href: '/leads', permission: 'leads.view' },
  { label: 'Admissions', href: '/admissions', permission: 'admissions.view' },
  { label: 'Reports', href: '/reports', permission: 'reports.view' },
  { label: 'Staff', href: '/staff', permission: 'staff.view' },
  { label: 'Branches', href: '/branches', permission: 'branches.view' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Roles', href: '/roles', permission: 'roles.manage' },
  { label: 'Permissions', href: '/permissions', permission: 'permissions.manage' },
  { label: 'Audit Logs', href: '/audit-logs', permission: 'audit_logs.view' },
  { label: 'Settings', href: '/settings', permission: 'settings.view' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <div className="flex flex-1">
      <aside className="hidden w-56 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 text-sm font-semibold text-slate-900">OBIAS Admin</div>
        <nav className="flex flex-1 flex-col gap-1 text-sm text-slate-600">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1.5 transition ${
                  active ? 'bg-red-50 font-medium text-red-700' : 'hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => logout()}
          className="mt-4 rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  );
}
