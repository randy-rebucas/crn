'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { landingRouteForUser, useAuth } from '@/lib/auth-context';
import { useInstructorName, useRoleLabel } from '@/lib/instructor-hooks';
import { timeAgo } from '@/lib/instructor-schedule';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from '@/lib/student-hooks';
import { adminIcons as icons } from '@/components/admin-shell';

// Distinct from (dashboard)'s sidebar and (student)'s bottom tab bar: a
// horizontal top bar sized for a desk/tablet workflow between classes
// (blueprint Section 17). Same red-700/slate operate palette as the other
// portals. Gating stays permission-based, same as (dashboard)/layout.tsx,
// not a hardcoded role check. A section lists every key its page's requests
// need (attendance is fetched per class, so it needs classes.view too).
const NAV_ITEMS: { label: string; href: string; icon: React.ReactNode; permissions?: string[] }[] = [
  { label: 'Today', href: '/instructor', icon: icons.home },
  { label: 'Classes', href: '/instructor/classes', icon: icons.learn, permissions: ['classes.view'] },
  {
    label: 'Attendance',
    href: '/instructor/attendance',
    icon: icons.users,
    permissions: ['attendance.view', 'classes.view'],
  },
  {
    label: 'Grading',
    href: '/instructor/grading',
    icon: icons.clipboardCheck,
    permissions: ['exams.grade', 'exams.view'],
  },
];

// Pages are gated the same way as (dashboard)/layout.tsx: longest-prefix
// match against the nav, so a direct URL to a section the account can't use
// redirects instead of rendering a page whose every request 403s.
function requiredPermissionsFor(pathname: string): string[] | undefined {
  const match = NAV_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match?.permissions;
}

// Menu popover state: closes on outside click or Escape, and Escape hands
// focus back to the trigger so keyboard users aren't dropped on <body>.
function useMenu<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref, triggerRef };
}

function NotificationsMenu() {
  const { open, setOpen, ref, triggerRef } = useMenu<HTMLDivElement>();
  const notifications = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const items = (notifications.data ?? []).slice(0, 6);
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        {icons.bell}
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgb(15_23_42/0.25)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="rounded text-xs font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
              >
                Mark all read ({unread})
              </button>
            )}
          </div>
          {notifications.isLoading && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}
          {notifications.isError && (
            <p className="px-4 py-6 text-sm text-red-700">Couldn&apos;t load notifications. Try again shortly.</p>
          )}
          {notifications.data && items.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">You&apos;re all caught up.</p>
          )}
          {items.length > 0 && (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <>
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-red-600'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.readAt ? 'text-slate-600' : 'font-medium text-slate-900'}`}>
                        {n.title}
                      </span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>}
                      <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </>
                );
                // Notifications carry no link target, so the only action is
                // marking one read — a read row is plain text, not a dead button.
                return (
                  <li key={n.id}>
                    {n.readAt ? (
                      <div className="flex items-start gap-3 px-4 py-3">{content}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(n.id)}
                        aria-label={`${n.title}. Mark as read`}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-700"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { logout } = useAuth();
  const router = useRouter();
  const name = useInstructorName();
  const role = useRoleLabel();
  const { open, setOpen, ref, triggerRef } = useMenu<HTMLDivElement>();
  const initials = name.full
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:pr-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800 text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-semibold text-slate-900">{name.full}</span>
          <span className="block text-[11px] text-slate-500">{role}</span>
        </span>
        <span className="hidden text-slate-400 sm:block">{icons.chevronDown}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-12px_rgb(15_23_42/0.25)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-slate-900">{name.full}</div>
            <div className="text-xs text-slate-500">{role}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-slate-400">{icons.logout}</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const canUse = (permissions?: string[]) => !permissions || permissions.every((p) => hasPermission(p));
  const isAllowed = canUse(requiredPermissionsFor(pathname));
  // Someone with no instructor section at all (a student, an admin typing the
  // URL) belongs in their own portal, not on an empty "Today" page.
  const hasAnySection = NAV_ITEMS.some((item) => item.permissions && canUse(item.permissions));
  const home = user ? landingRouteForUser(user) : '/login';
  const redirectTo = !user ? null : !hasAnySection && home !== '/instructor' ? home : !isAllowed ? '/instructor' : null;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && redirectTo) router.replace(redirectTo);
  }, [isLoading, redirectTo, router]);

  // The phone nav scrolls sideways; keep the current section in view.
  const mobileNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mobileNavRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname, user]);

  if (isLoading || !user || redirectTo) {
    return <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">Loading…</div>;
  }

  const visibleItems = NAV_ITEMS.filter((item) => canUse(item.permissions));

  const nav = visibleItems.map((item) => {
    const active =
      item.href === '/instructor' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
          active
            ? 'bg-red-700 text-white shadow-[0_6px_16px_-8px_rgb(185_28_28/0.8)]'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className={active ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
        {item.label}
      </Link>
    );
  });

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900 selection:bg-red-100 selection:text-red-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2.5 sm:px-6">
          <Link href="/instructor" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/obias_crn_logo_transparent.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
            <span className="leading-none">
              <span className="block font-[family-name:var(--font-heading)] text-lg font-bold tracking-wide text-red-700">
                OBIAS
              </span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Instructor Portal
              </span>
            </span>
          </Link>

          <nav aria-label="Instructor" className="hidden items-center gap-1 md:flex">
            {nav}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationsMenu />
            <AccountMenu />
          </div>
        </div>

        <nav
          ref={mobileNavRef}
          aria-label="Instructor"
          className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 [scrollbar-width:none] md:hidden"
        >
          {nav}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
