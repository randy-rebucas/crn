'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useMyNotifications, useMyStudentProfile } from '@/lib/student-hooks';
import { BottomTabBar, MobileNavDrawer, StudentSidebar, StudentTopBar, icons } from '@/components/student-ui';

const TAB_ITEMS = [
  { label: 'Home', href: '/student', icon: icons.home },
  { label: 'Learn', href: '/student/learn', icon: icons.learn },
  { label: 'Exams', href: '/student/exams', icon: icons.exams },
  { label: 'Schedule', href: '/student/schedule', icon: icons.schedule },
  { label: 'Profile', href: '/student/profile', icon: icons.profile },
];

// Full nav list, used by both the desktop sidebar and the mobile
// hamburger drawer. The 5-slot BottomTabBar only surfaces the items a
// student needs one tap away most often (mirrored in TAB_ITEMS above);
// everything else — Progress, Certificates, Notifications, Help,
// Settings — lives here instead of being buried behind Profile.
const SIDEBAR_ITEMS = [
  { label: 'Dashboard', href: '/student', icon: icons.home },
  { label: 'My Courses', href: '/student/learn', icon: icons.learn },
  { label: 'Exams', href: '/student/exams', icon: icons.exams },
  { label: 'Schedule', href: '/student/schedule', icon: icons.schedule },
  { label: 'Progress', href: '/student/progress', icon: icons.progress },
  { label: 'Certificates', href: '/student/certificates', icon: icons.certificate },
  { label: 'Notifications', href: '/student/notifications', icon: icons.bell },
  { label: 'Profile', href: '/student/profile', icon: icons.profile },
  { label: 'Help & Support', href: '/student/help', icon: icons.help },
  { label: 'Settings', href: '/student/profile', icon: icons.settings },
];

// Auth-gating mirrors (dashboard)/layout.tsx. Below `lg` the shell is a
// phone-width, single-column layout with a fixed bottom tab bar; at `lg`
// and up a left sidebar + top search bar take over (StudentSidebar /
// BottomTabBar are mutually exclusive by breakpoint, not by route).
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const notifications = useMyNotifications();
  const profile = useMyStudentProfile();
  const unreadCount = notifications.data?.filter((n) => !n.readAt).length ?? 0;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="flex flex-1 bg-slate-50">
      <StudentSidebar items={SIDEBAR_ITEMS} />
      <MobileNavDrawer items={SIDEBAR_ITEMS} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentTopBar
          unreadCount={unreadCount}
          name={profile.data?.user.firstName}
          onMenuClick={() => setDrawerOpen(true)}
        />
        {children}
        <BottomTabBar items={TAB_ITEMS} />
      </div>
    </div>
  );
}
