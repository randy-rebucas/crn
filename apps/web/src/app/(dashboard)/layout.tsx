'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { AdminSidebar, AdminTopBar, MobileNavDrawer, adminIcons, type AdminNavGroup } from '@/components/admin-shell';

interface Notification {
  id: string;
  readAt: string | null;
}

// Nav is role-aware, not role-name-aware (blueprint Section 25): each item
// names the permission that unlocks it, and the guard is the same
// `hasPermission` check the API itself enforces — never a hardcoded role
// check like `user.roles.includes('admin')`. Grouped to match the
// reference dashboard's sectioned sidebar (Users Management, Courses &
// Content, ...); a group of one item (Dashboard, Reports, ...) renders as
// a plain top-level link instead of a collapsible section.
const NAV_GROUPS: AdminNavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/dashboard', icon: adminIcons.home }] },
  {
    label: 'Enrollment Pipeline',
    items: [
      { label: 'Leads', href: '/leads', icon: adminIcons.funnel, permission: 'leads.view' },
      { label: 'Admissions', href: '/admissions', icon: adminIcons.clipboardCheck, permission: 'admissions.view' },
      { label: 'Enrollments', href: '/enrollments', icon: adminIcons.userPlus, permission: 'enrollments.view' },
      { label: 'Students', href: '/students', icon: adminIcons.users, permission: 'students.view' },
    ],
  },
  {
    label: 'Courses & Content',
    items: [
      { label: 'Programs', href: '/programs', icon: adminIcons.layers, permission: 'programs.view' },
      { label: 'Courses', href: '/courses', icon: adminIcons.learn, permission: 'courses.view' },
      { label: 'Curriculum', href: '/curriculum', icon: adminIcons.layers, permission: 'courses.view' },
      { label: 'Content', href: '/content', icon: adminIcons.fileText, permission: 'content.view' },
      { label: 'Classes', href: '/classes', icon: adminIcons.users, permission: 'classes.view' },
      { label: 'Schedule', href: '/schedules', icon: adminIcons.schedule, permission: 'schedules.view' },
    ],
  },
  {
    label: 'Exams & Attendance',
    items: [
      { label: 'Attendance', href: '/attendance', icon: adminIcons.checkSquare, permission: 'attendance.view' },
      { label: 'Exams', href: '/exams', icon: adminIcons.exams, permission: 'exams.view' },
      { label: 'Results', href: '/results', icon: adminIcons.barChart, permission: 'exams.grade' },
    ],
  },
  {
    label: 'Payments & Billing',
    items: [{ label: 'Finance', href: '/finance', icon: adminIcons.creditCard, permission: 'payments.view' }],
  },
  {
    label: 'Reports & Analytics',
    items: [{ label: 'Reports', href: '/reports', icon: adminIcons.pieChart, permission: 'reports.view' }],
  },
  {
    label: 'Users Management',
    items: [
      { label: 'Staff', href: '/staff', icon: adminIcons.users, permission: 'staff.view' },
      { label: 'Branches', href: '/branches', icon: adminIcons.mapPin, permission: 'branches.view' },
      { label: 'Roles', href: '/roles', icon: adminIcons.shield, permission: 'roles.manage' },
      { label: 'Permissions', href: '/permissions', icon: adminIcons.key, permission: 'permissions.manage' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Notifications', href: '/notifications', icon: adminIcons.bell },
      { label: 'Audit Logs', href: '/audit-logs', icon: adminIcons.history, permission: 'audit_logs.view' },
      { label: 'Settings', href: '/settings', icon: adminIcons.settings, permission: 'settings.view' },
    ],
  },
];

// Flattened once from NAV_GROUPS — the single source of truth for which
// permission unlocks which route, already used to decide what's visible in
// the sidebar. Reused here as a page-level access gate: the sidebar hiding
// a link doesn't stop someone from typing the URL directly, and the backend
// enforcing the same permission per-request is not itself a reason to skip
// this — a page-level redirect avoids ever mounting a restricted page's
// components (and firing their queries) client-side in the first place.
const PERMISSION_BY_PATH: { href: string; permission?: string }[] = NAV_GROUPS.flatMap((group) => group.items);

function requiredPermissionFor(pathname: string): string | undefined {
  // Longest-prefix match so nested routes (e.g. /students/:id) inherit
  // their section's permission (/students).
  const match = PERMISSION_BY_PATH.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.permission;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const requiredPermission = requiredPermissionFor(pathname);
  // Students hold SELF-scoped students/courses/exams.view, which would light
  // up half this sidebar; their portal is /student, same as the instructor
  // layout sends people without an instructor section home.
  const isStudent = user ? landingRouteForUser(user) === '/student' : false;
  const isAllowed = !isStudent && (!requiredPermission || hasPermission(requiredPermission));

  useEffect(() => {
    if (!isLoading && user && !isAllowed) {
      router.replace(isStudent ? '/student' : '/dashboard');
    }
  }, [isLoading, user, isAllowed, isStudent, router]);

  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await apiClient.get('/v1/notifications')).data,
    enabled: Boolean(user),
  });
  const unreadCount = notificationsQuery.data?.filter((n) => !n.readAt).length ?? 0;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const visibleGroups = useMemo(() => {
    if (!user) return [];
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
    })).filter((group) => group.items.length > 0);
  }, [user, hasPermission]);

  if (isLoading || !user || !isAllowed) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  const allVisibleItems = visibleGroups.flatMap((group) => group.items);

  return (
    <div className="flex h-dvh min-h-0 bg-slate-50">
      <AdminSidebar groups={visibleGroups} />
      <MobileNavDrawer groups={visibleGroups} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminTopBar
          navItems={allVisibleItems}
          unreadCount={unreadCount}
          email={user.email}
          role={user.roles[0] ?? 'Staff'}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        <div className="flex shrink-0 flex-col items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} OBIAS Nursing &amp; Allied Courses Review Center. All rights reserved.</p>
          <p className="flex items-center gap-2 font-medium text-red-700">
            Your Success Is Our Mission!
            <svg viewBox="0 0 48 16" className="h-3.5 w-12" fill="none">
              <path
                d="M0 8h10l3-6 4 12 3-9 2 3h26"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </p>
        </div>
      </div>
    </div>
  );
}
