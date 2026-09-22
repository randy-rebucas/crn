'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

// Distinct from (dashboard)'s sidebar and (student)'s bottom tab bar: a
// horizontal top bar sized for a desk/tablet workflow between classes,
// with an indigo accent so the shell itself signals "you're in the
// instructor portal" (blueprint Section 17). Gating stays permission-based,
// same as (dashboard)/layout.tsx, not a hardcoded role check.
const NAV_ITEMS: { label: string; href: string; permission?: string }[] = [
  { label: 'Today', href: '/instructor' },
  { label: 'Classes', href: '/instructor/classes', permission: 'classes.view' },
  { label: 'Attendance', href: '/instructor/attendance', permission: 'attendance.view' },
  { label: 'Grading', href: '/instructor/grading', permission: 'exams.grade' },
];

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
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
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold text-indigo-700">OBIAS Instructor</span>
            <nav className="flex items-center gap-1 text-sm text-slate-600">
              {visibleItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-1.5 transition ${
                      active ? 'bg-indigo-50 font-medium text-indigo-700' : 'hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={() => logout()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
