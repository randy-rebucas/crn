'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { AdminSidebar, AdminTopBar, MobileNavDrawer } from '@/components/admin-shell';
import { NAV_GROUPS, visibleNavGroups } from '@/components/admin-nav';
import { QuickTour } from '@/components/quick-tour';

interface Notification {
  id: string;
  readAt: string | null;
}

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

function DashboardFooter({ className }: { className: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500 sm:flex-row sm:text-left md:px-6 ${className}`}
    >
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
  );
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

  const visibleGroups = useMemo(() => (user ? visibleNavGroups(hasPermission) : []), [user, hasPermission]);

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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
          {/* On a phone a pinned footer would permanently eat the bottom of
              the screen, so below md it scrolls in after the page content. */}
          <DashboardFooter className="-mx-4 -mb-4 mt-8 md:hidden" />
        </main>
        <DashboardFooter className="hidden shrink-0 md:flex" />
      </div>
      <QuickTour portal="dashboard" autoStart={pathname === '/dashboard'} />
    </div>
  );
}
