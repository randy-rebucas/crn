'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { BottomTabBar, icons } from '@/components/student-ui';

const TAB_ITEMS = [
  { label: 'Home', href: '/student', icon: icons.home },
  { label: 'Learn', href: '/student/learn', icon: icons.learn },
  { label: 'Exams', href: '/student/exams', icon: icons.exams },
  { label: 'Schedule', href: '/student/schedule', icon: icons.schedule },
  { label: 'Profile', href: '/student/profile', icon: icons.profile },
];

// Auth-gating mirrors (dashboard)/layout.tsx, but the shell underneath is
// a phone-width, single-column, card-based layout with a fixed bottom tab
// bar — this is deliberately not a compressed admin dashboard.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      {children}
      <BottomTabBar items={TAB_ITEMS} />
    </div>
  );
}
