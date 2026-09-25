'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

// Mobile-first primitives for the student route group. Same red-700 /
// slate token palette as the admin dashboard (components/ui.tsx), but a
// different shell: single-column cards + a fixed bottom tab bar instead of
// a sidebar and data tables.

export interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  keywords?: string;
}

export function BottomTabBar({ items }: { items: TabItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                active ? 'text-red-700' : 'text-slate-500'
              }`}
              style={{ minHeight: 44 }}
            >
              <span className={active ? 'text-red-700' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4 lg:max-w-none lg:px-8 lg:pb-8 lg:pt-6">{children}</div>;
}

// Root "/student" only matches exactly; every other item also owns its
// sub-routes (e.g. /student/exams/[id]).
function isActive(pathname: string, href: string) {
  if (href === '/student') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/student"
      className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700"
    >
      <Image
        src="/obias_crn_logo_transparent.png"
        alt=""
        width={64}
        height={48}
        className={`shrink-0 object-contain ${compact ? 'h-7 w-9' : 'h-12 w-16'}`}
        priority
      />
      <span className="min-w-0 leading-none">
        <span
          className={`block font-[family-name:var(--font-heading)] font-bold tracking-wide text-red-700 ${compact ? 'text-base' : 'text-[1.7rem] leading-[0.95]'}`}
        >
          OBIAS
        </span>
        {!compact && (
          <span className="mt-1 block font-[family-name:var(--font-heading)] text-[10.5px] font-semibold uppercase leading-[1.15] tracking-[0.02em] text-slate-900">
            Nursing &amp; Allied Courses
            <br />
            Review Center
          </span>
        )}
      </span>
      <span className="sr-only">OBIAS Nursing &amp; Allied Courses Review Center, student home</span>
    </Link>
  );
}

function NavItem({ item, onNavigate }: { item: TabItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group flex min-h-[44px] items-center gap-3.5 rounded-lg px-4 text-[15px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
        active
          ? 'bg-red-700 text-white shadow-[0_8px_18px_-10px_rgb(185_28_28/0.9)]'
          : 'text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
      }`}
    >
      <span
        className={`shrink-0 transition [&_svg]:h-[22px] [&_svg]:w-[22px] ${active ? 'text-white' : 'text-slate-600 group-hover:text-red-700'}`}
      >
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
            active ? 'bg-white text-red-700' : 'bg-red-600 text-white'
          }`}
        >
          {item.badge > 9 ? '9+' : item.badge}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </Link>
  );
}

// Study pages up top; account/support pages settle at the foot of the rail
// (pushed down by `mt-auto`), directly above the Keep Going card — the same
// split the reference sidebar uses, separated by space rather than a rule.
function SidebarNav({
  main,
  account,
  onNavigate,
  footer,
}: {
  main: TabItem[];
  account: TabItem[];
  onNavigate?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <ul className="space-y-0.5">
        {main.map((item) => (
          <li key={item.href}>
            <NavItem item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
      <ul className="mt-auto space-y-0.5 pt-6">
        {account.map((item) => (
          <li key={item.href}>
            <NavItem item={item} onNavigate={onNavigate} />
          </li>
        ))}
        {footer}
      </ul>
    </>
  );
}

// Gold brand card at the foot of the rail — the portal's standing nudge
// toward the one action that matters most before board day.
function KeepGoingCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="relative isolate overflow-hidden rounded-xl bg-[radial-gradient(120%_90%_at_85%_10%,#fde68a_0%,#fcd34d_45%,#fbbf24_100%)] p-4 shadow-[0_10px_24px_-16px_rgb(146_64_14/0.6)]">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-slate-900">{capGlyph}</span>
        <p className="min-w-0 -rotate-3 leading-none text-slate-900">
          <span className="font-script block pb-1.5 text-[1.5rem] leading-[1.2]">Same Passion.</span>
          <span className="block font-[family-name:var(--font-heading)] text-2xl font-bold uppercase leading-[1.05] tracking-wide">
            A Healthier
          </span>
          <span className="font-script block pl-3 pt-1.5 text-[1.6rem] leading-[1.2]">Tomorrow</span>
          <svg viewBox="0 0 100 8" className="ml-2 h-2 w-28 text-red-700" aria-hidden>
            <path d="M2 6C30 1 70 0 98 3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        </p>
      </div>
      <Link
        href="/student/exams"
        onClick={onNavigate}
        className="mt-4 flex min-h-[42px] items-center justify-center gap-1.5 rounded-md bg-red-700 px-3 text-[15px] font-semibold text-white shadow-[0_6px_14px_-8px_rgb(127_29_29/0.9)] transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900"
      >
        Keep Going!
      </Link>
    </div>
  );
}

// Desktop left rail — the (student) shell's wide-viewport nav (see
// NAV_MAIN / NAV_ACCOUNT in layout.tsx). Pinned to the viewport so the nav
// never scrolls away on a long page. Hidden below `lg`, where a
// hamburger-triggered MobileNavDrawer covers the same items instead.
export function StudentSidebar({ main, account }: { main: TabItem[]; account: TabItem[] }) {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 lg:flex"
      aria-label="Student navigation"
    >
      <div className="flex shrink-0 items-center px-5 pb-4 pt-5">
        <Brand />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-2 [scrollbar-width:thin]" aria-label="Primary">
        <SidebarNav main={main} account={account} />
        <div className="mt-5 [@media(max-height:940px)]:hidden">
          <KeepGoingCard />
        </div>
      </nav>
    </aside>
  );
}

// Slide-in equivalent of StudentSidebar for < lg, opened from the
// hamburger button in StudentTopBar. Carries the full nav list (including
// items like Progress/Certificates that the 5-slot BottomTabBar can't fit).
export function MobileNavDrawer({
  main,
  account,
  open,
  onClose,
}: {
  main: TabItem[];
  account: TabItem[];
  open: boolean;
  onClose: () => void;
}) {
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button aria-label="Close menu" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-slate-50 shadow-[12px_0_32px_-12px_rgb(15_23_42/0.35)]">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
          <Brand />
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-red-700"
          >
            {icons.close}
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-2" aria-label="Primary">
          <SidebarNav
            main={main}
            account={account}
            onNavigate={onClose}
            footer={
              <li>
                <button
                  onClick={handleLogout}
                  className="flex min-h-[46px] w-full items-center gap-3.5 rounded-lg px-4 text-left text-[15px] font-medium text-slate-700 transition hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-red-700"
                >
                  <span className="text-slate-600 [&_svg]:h-[22px] [&_svg]:w-[22px]">{icons.logout}</span>
                  Sign out
                </button>
              </li>
            }
          />
          <div className="mt-5">
            <KeepGoingCard onNavigate={onClose} />
          </div>
        </nav>
      </div>
    </div>
  );
}

// Jump-to-page search. There is no backend search endpoint for lessons or
// exams, so this honestly matches the student's own pages (by label and a
// few synonyms) rather than promising content search it can't deliver.
function PageSearch({ items }: { items: TabItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [items, query]);

  const go = (href: string) => {
    router.push(href);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full max-w-lg">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
      <input
        type="search"
        value={query}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls="student-page-search"
        aria-label="Search pages"
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === 'Enter' && matches[cursor]) {
            go(matches[cursor].href);
          }
        }}
        placeholder="Jump to exams, schedule, certificates…"
        className="h-10 w-full rounded-xl border border-transparent bg-slate-100 pl-10 pr-3 text-sm text-slate-800 transition placeholder:text-slate-500 hover:bg-slate-200/60 focus:border-red-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-600/10"
      />
      {open && query.trim() !== '' && (
        <div
          id="student-page-search"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_12px_32px_-12px_rgb(15_23_42/0.25)]"
        >
          {matches.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No page matches &ldquo;{query.trim()}&rdquo;.</p>}
          {matches.map((item, i) => (
            <button
              key={item.href}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(item.href)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${i === cursor ? 'bg-red-50 text-red-800' : 'text-slate-700'}`}
            >
              <span className={i === cursor ? 'text-red-700' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The auth user only carries an email, and the student profile can be
// missing or still loading — so the menu always renders, naming the
// student from their profile when it exists and from their email otherwise.
function displayNameParts(firstName?: string, lastName?: string, email?: string) {
  const named = [firstName, lastName].filter((p): p is string => Boolean(p?.trim()));
  if (named.length > 0) return named;
  const local = email?.split('@')[0] ?? '';
  const fromEmail = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return fromEmail.length > 0 ? fromEmail : ['Student'];
}

function AccountMenu({ firstName, lastName, email }: { firstName?: string; lastName?: string; email?: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const parts = displayNameParts(firstName, lastName, email);
  const fullName = parts.join(' ');
  const initials = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-full p-0.5 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 lg:py-1 lg:pl-1 lg:pr-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800 text-xs font-semibold text-white ring-2 ring-white">
          {initials}
        </span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block max-w-[11rem] truncate text-sm font-semibold text-slate-900">{fullName}</span>
          <span className="block text-[11px] text-slate-500">Student</span>
        </span>
        <span className={`hidden text-slate-400 transition lg:block ${open ? 'rotate-180' : ''}`}>{icons.chevronDown}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-12px_rgb(15_23_42/0.25)]"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-slate-900">{fullName}</div>
            <div className="truncate text-xs text-slate-500">{email ?? 'Student'}</div>
          </div>
          <Link
            href="/student/profile"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icons.profile}</span>
            My profile
          </Link>
          <Link
            href="/student/settings"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icons.settings}</span>
            Settings
          </Link>
          <Link
            href="/student/help"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icons.help}</span>
            Help &amp; support
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <span className="text-slate-400">{icons.logout}</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function StudentTopBar({
  unreadCount,
  firstName,
  lastName,
  email,
  searchItems,
  onMenuClick,
}: {
  unreadCount: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  searchItems: TabItem[];
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const onNotifications = isActive(pathname, '/student/notifications');

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4 lg:h-16 lg:max-w-none lg:gap-4 lg:px-8">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-red-700 lg:hidden"
        >
          {icons.menu}
        </button>

        <div className="flex flex-1 lg:hidden">
          <Brand compact />
        </div>

        <div className="hidden flex-1 items-center lg:flex">
          <PageSearch items={searchItems} />
        </div>

        <div className="flex items-center gap-1 lg:gap-3">
          <Link
            href="/student/notifications"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            aria-current={onNotifications ? 'page' : undefined}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
              onNotifications ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {icons.bell}
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <span aria-hidden className="hidden h-8 w-px bg-slate-200 lg:block" />
          <AccountMenu firstName={firstName} lastName={lastName} email={email} />
        </div>
      </div>
    </header>
  );
}

// Solid mortarboard for the Keep Going card — filled, not outlined, so it
// holds its weight at 48px against the gold.
const capGlyph = (
  <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
    <path d="M24 9 2 18.5 24 28l22-9.5L24 9Z" fill="currentColor" />
    <path d="M11 23.5v8c3.5 3.2 8 4.8 13 4.8s9.5-1.6 13-4.8v-8L24 29.2 11 23.5Z" fill="currentColor" />
    <path d="M42 20v11" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={42} cy={32.5} r={2.2} fill="#b91c1c" />
  </svg>
);

export function StudentPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h2>;
}

export function ProgressBar({ value, max, tone = 'red' }: { value: number; max: number; tone?: 'red' | 'green' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = tone === 'green' ? 'bg-emerald-600' : 'bg-red-700';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

// Page header for student destination pages (My Courses, Certificates): a
// round maroon badge, the title with a context line, the brand ribbon corner
// from the home hero, and an optional row of orienting figures.
export function StudentPageHero({
  badge,
  badgeTone = 'bg-red-700 text-white',
  title,
  meta,
  children,
}: {
  badge: React.ReactNode;
  badgeTone?: string;
  title: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(100deg,#fff_55%,#fffbeb)] p-5 pr-12 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-6 sm:pr-28">
      <div aria-hidden className="absolute inset-y-0 right-0 w-10 bg-amber-300 [clip-path:polygon(70%_0,100%_0,100%_100%,0_100%)] sm:w-24" />
      <div aria-hidden className="absolute inset-y-0 right-0 w-10 bg-red-600 [clip-path:polygon(70%_0,78%_0,8%_100%,0_100%)] sm:w-24" />

      <div className="relative flex items-center gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16 [&_svg]:h-7 [&_svg]:w-7 sm:[&_svg]:h-8 sm:[&_svg]:w-8 ${badgeTone}`}
        >
          {badge}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-wide text-slate-900 sm:text-3xl">{title}</h1>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">{meta}</div>}
        </div>
      </div>

      {children && (
        <dl className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-100 pt-5 md:grid-cols-4">{children}</dl>
      )}
    </section>
  );
}

export function HeroFigure({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div className="flex min-w-0 flex-col-reverse">
        <dt className="text-xs leading-snug text-slate-500">{label}</dt>
        <dd className="text-xl font-bold leading-tight tabular-nums text-slate-900">{value}</dd>
      </div>
    </div>
  );
}

// Titled white panel shared by the student home and My Courses: icon + title
// on the left, an optional link or badge on the right.
export function Panel({
  title,
  icon,
  action,
  children,
  className = '',
  headingLevel = 2,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Heading className="flex items-center gap-2.5 text-lg font-semibold tracking-wide text-slate-900">
          <span className="text-red-700">{icon}</span>
          {title}
        </Heading>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {children}
      {icons.arrowRight}
    </Link>
  );
}

export function PanelMessage({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center text-sm ${
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'
      }`}
    >
      {children}
    </div>
  );
}

export function SkeletonRows({ count = 3, className = 'h-12' }: { count?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
      ))}
    </div>
  );
}

// Discipline glyphs for program badges (same 1.7px stroke / 24 grid as `icons`).
export const programGlyphs = {
  stethoscope: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M6 3.5H5a1 1 0 0 0-1 1V9a5 5 0 0 0 10 0V4.5a1 1 0 0 0-1-1h-1M9 14v1.5a4.5 4.5 0 0 0 9 0V13"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={18} cy={11} r={2} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  microscope: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="m9 4 3-1.5 3 6-3 1.5-3-6ZM10.5 7.2 7.5 8.7M13.5 10a5 5 0 0 1 1.5 9.5M5 20.5h14M8 17.5h5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  cradle: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={6.5} r={2.5} stroke="currentColor" strokeWidth={1.7} />
      <path
        d="M4 12.5c2 4.5 5 6 8 6s6-1.5 8-6M8 12.5c1 1.6 2.4 2.5 4 2.5s3-.9 4-2.5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  therapy: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={13} cy={4.8} r={1.9} stroke="currentColor" strokeWidth={1.7} />
      <path
        d="m9 20 2.5-5.5L14 16v4M11.5 14.5l1-5 3.5 2.5 3 -1M12.5 9.5 9 11l-2.5 3"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export function programGlyph(name: string) {
  const n = name.toLowerCase();
  if (n.includes('midwif')) return programGlyphs.cradle;
  if (n.includes('med') && n.includes('tech')) return programGlyphs.microscope;
  if (n.includes('therap')) return programGlyphs.therapy;
  if (n.includes('nurs')) return programGlyphs.stethoscope;
  return icons.learn;
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Tab bar icons (inline SVG, no icon package dependency) ---------------

export const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  learn: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 6.5C4 5.7 4.7 5 6 5h5v14H6c-1.3 0-2-.7-2-1.5v-11ZM20 6.5c0-.8-.7-1.5-2-1.5h-5v14h5c1.3 0 2-.7 2-1.5v-11Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  ),
  exams: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M7 3.5h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2v-16a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 11.5h6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={4} y={5.5} width={16} height={15} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={8} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx={11} cy={11} r={6.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  progress: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 20V12M11 20V4M18 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M6 10.5a6 6 0 1 1 12 0c0 3.2 1 4.8 1.6 5.6.3.4 0 1-.5 1H4.9c-.5 0-.8-.6-.5-1 .6-.8 1.6-2.4 1.6-5.6Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  certificate: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={9} r={5.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m9 13.5-1.5 6.5 4.5-2.5 4.5 2.5-1.5-6.5" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={1.7} />
      <path
        d="M9.8 9.3a2.2 2.2 0 1 1 3.1 2c-.9.5-1.4.9-1.4 2"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={16.5} r={0.9} fill="currentColor" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={1.7} />
      <path
        d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.5 8.5a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 16l4-4-4-4M20 12H9"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="M10.2 8.8v6.4l5-3.2-5-3.2Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  ),
  practice: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M9 4.5H7a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-2" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <rect x={9} y={3} width={6} height={3} rx={1} stroke="currentColor" strokeWidth={1.7} />
      <path d="M9 11h.01M9 15h.01M12 11h3M12 15h3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  ),
  quiz: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={4} y={4} width={16} height={16} rx={2.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8.5 12.3 2.4 2.4 4.8-5.2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  materials: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M13.5 3.5v5h5M9 12.5h6M9 16h6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  megaphone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5v-15L7 9H5a1 1 0 0 0-1 1ZM7 15l1.2 4.5M18.5 9.5a3.5 3.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2L12 3.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M11 3.5h5.5V9M16.5 3.5 9 11M14 11.5V15a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V7.5A1.5 1.5 0 0 1 5 6h3.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
