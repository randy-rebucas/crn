'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { useMyNotifications, useMyStudentProfile } from '@/lib/student-hooks';
import { BottomTabBar, MobileNavDrawer, StudentSidebar, StudentTopBar, icons } from '@/components/student-ui';

const TAB_ITEMS = [
  { label: 'Home', href: '/student', icon: icons.home },
  { label: 'Learn', href: '/student/learn', icon: icons.learn },
  { label: 'Exams', href: '/student/exams', icon: icons.exams },
  { label: 'Schedule', href: '/student/schedule', icon: icons.schedule },
  { label: 'Profile', href: '/student/profile', icon: icons.profile },
];

// Full nav, used by both the desktop sidebar and the mobile hamburger
// drawer, split into study pages and account pages. The 5-slot
// BottomTabBar only surfaces the items a student needs one tap away most
// often (mirrored in TAB_ITEMS above). `keywords` feed the top-bar page
// search. Each href appears once, so exactly one item is ever active.
const NAV_MAIN = [
  { label: 'Dashboard', href: '/student', icon: icons.home, keywords: 'home overview today' },
  { label: 'My Courses', href: '/student/learn', icon: icons.learn, keywords: 'learn lessons subjects modules curriculum' },
  { label: 'Video Lessons', href: '/student/videos', icon: icons.video, keywords: 'videos lectures recordings watch' },
  { label: 'Practice Exams', href: '/student/practice-exams', icon: icons.practice, keywords: 'mock board final test' },
  { label: 'Quizzes', href: '/student/quizzes', icon: icons.quiz, keywords: 'practice diagnostic test' },
  { label: 'Study Materials', href: '/student/materials', icon: icons.materials, keywords: 'handouts notes pdf documents downloads' },
  { label: 'Schedule', href: '/student/schedule', icon: icons.schedule, keywords: 'classes calendar timetable' },
  { label: 'Progress', href: '/student/progress', icon: icons.progress, keywords: 'performance results scores grades' },
  { label: 'Certificates', href: '/student/certificates', icon: icons.certificate, keywords: 'credentials completion' },
  { label: 'Notifications', href: '/student/notifications', icon: icons.bell, keywords: 'announcements alerts updates news' },
];

// Settings is where a student edits their account (contact details,
// password); /student/profile stays the read-only summary, reached from the
// bottom tab bar and the account menu.
const NAV_ACCOUNT = [
  { label: 'Help & Support', href: '/student/help', icon: icons.help, keywords: 'faq contact assistance' },
  { label: 'Settings', href: '/student/settings', icon: icons.settings, keywords: 'account password phone address emergency contact' },
];

// Search also reaches the combined exam catalog, which has no nav slot of
// its own (Practice Exams and Quizzes are its two halves).
const SEARCH_ITEMS = [
  ...NAV_MAIN,
  { label: 'All exams', href: '/student/exams', icon: icons.exams, keywords: 'exams mock quiz practice diagnostic final' },
  { label: 'Profile', href: '/student/profile', icon: icons.profile, keywords: 'profile personal details enrollments' },
  ...NAV_ACCOUNT,
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

  // Staff typing /student belong in their own portal: this shell reads
  // "my profile / my enrollments", which only exists for a student account.
  const home = user ? landingRouteForUser(user) : null;
  const redirectTo = !user ? null : home !== '/student' ? home : null;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && redirectTo) router.replace(redirectTo);
  }, [isLoading, redirectTo, router]);

  const main = useMemo(
    () => NAV_MAIN.map((item) => (item.href === '/student/notifications' ? { ...item, badge: unreadCount } : item)),
    [unreadCount],
  );
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  if (isLoading || !user || redirectTo) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="flex flex-1 bg-slate-50 selection:bg-red-100 selection:text-red-900">
      <StudentSidebar main={main} account={NAV_ACCOUNT} />
      <MobileNavDrawer main={main} account={NAV_ACCOUNT} open={drawerOpen} onClose={closeDrawer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentTopBar
          unreadCount={unreadCount}
          firstName={profile.data?.user.firstName}
          lastName={profile.data?.user.lastName}
          email={profile.data?.user.email ?? user.email}
          searchItems={SEARCH_ITEMS}
          onMenuClick={() => setDrawerOpen(true)}
        />
        {children}
        <BottomTabBar items={TAB_ITEMS} />
      </div>
    </div>
  );
}
