'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { icons as baseIcons, Chevron } from '@/components/student-ui';

// Desktop/admin shell for the (dashboard) route group. Same red-700/slate
// token palette and component conventions as components/ui.tsx and the
// (student) shell (student-ui.tsx) — this is the "operate" surface's own
// visual language, kept deliberately separate from the public marketing
// site's maroon/gold DESIGN.md system (see that file's Don'ts).

export interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

// A few icons the student shell doesn't need; everything else (bell,
// search, menu, close, chevronDown, logout, settings, schedule, exams,
// home) is reused as-is from student-ui.tsx's `icons` export.
const icons = {
  ...baseIcons,
  grid: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={4} y={4} width={7} height={7} rx={1.3} stroke="currentColor" strokeWidth={1.7} />
      <rect x={13} y={4} width={7} height={7} rx={1.3} stroke="currentColor" strokeWidth={1.7} />
      <rect x={4} y={13} width={7} height={7} rx={1.3} stroke="currentColor" strokeWidth={1.7} />
      <rect x={13} y={13} width={7} height={7} rx={1.3} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  funnel: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 5h16l-6 7.5v5.5l-4 2v-7.5L4 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  clipboardCheck: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={5.5} y={4.5} width={13} height={16} rx={1.6} stroke="currentColor" strokeWidth={1.7} />
      <path d="M9 4.2h6a1 1 0 0 1 1 1v1.3H8V5.2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="m9 13.2 2 2 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  userPlus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={9.5} cy={8.5} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 20c.9-3.4 3.6-5.3 6-5.3s5.1 1.9 6 5.3" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M18.5 8.5v5M16 11h5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m12 3.5 8 4.3-8 4.3-8-4.3 8-4.3Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="m4 12.3 8 4.3 8-4.3M4 16.3l8 4.3 8-4.3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  fileText: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M14 3.5V8h4M8.5 12.5h7M8.5 16h5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={8.5} cy={8} r={3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={9.5} r={2.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3 20c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 20c.6-2.4 2-4 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  checkSquare: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={4} y={4} width={16} height={16} rx={2.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8 12.5 2.5 2.5 5.5-6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  pieChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 3.8V12l7 3.3A8.2 8.2 0 1 1 12 3.8Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M13.5 3.9A8.2 8.2 0 0 1 19.9 11h-7.4l1-7.1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  creditCard: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth={1.7} />
      <path d="M7 14.5h4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 3.5 19 6v5.5c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6l7-2.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={8} cy={15.5} r={3.2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M10.3 13.2 18 5.5M15.3 8.2l2 2M18 5.5l2 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 10a8 8 0 1 1 2.3 5.6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M4 5v5h5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} as const;

export { icons as adminIcons };

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-5">
      <Image
        src="/obias_crn_logo_transparent.png"
        alt="OBIAS Nursing & Allied Courses Review Center"
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 object-contain"
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-extrabold tracking-tight text-red-700">OBIAS Admin</div>
        <div className="truncate text-[9px] font-medium uppercase tracking-wide text-slate-400">
          Nursing &amp; Allied Courses
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, onNavigate }: { item: AdminNavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className={active ? 'text-red-700' : 'text-slate-400'}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

// A group renders as a collapsible section when it has more than one item
// (matching the reference dashboard's expandable "Users Management" /
// "Courses & Content" sections); a single-item group renders as a plain
// top-level link, same as "Dashboard" or "Reports" in that reference.
function NavGroup({ group, onNavigate }: { group: AdminNavGroup; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groupHasActiveItem = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const [open, setOpen] = useState(groupHasActiveItem);

  useEffect(() => {
    if (groupHasActiveItem) setOpen(true);
  }, [groupHasActiveItem]);

  if (group.items.length === 1) {
    return <NavLink item={group.items[0]} onNavigate={onNavigate} />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
      >
        {group.label}
        <Chevron open={open} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNav({ groups, onNavigate }: { groups: AdminNavGroup[]; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-label="Primary">
      {groups.map((group) => (
        <NavGroup key={group.label} group={group} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

export function AdminSidebar({ groups }: { groups: AdminNavGroup[] }) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside className="hidden h-full min-h-0 w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <Brand />
      <SidebarNav groups={groups} />
      <div className="px-3 pb-3">
        <div className="rounded-xl bg-amber-50 p-4 text-center">
          <p className="text-xs font-semibold text-slate-800">Same Passion. A Healthier Tomorrow.</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Empowering more healthcare professionals through quality review education.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <span className="text-slate-400">{icons.logout}</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// Slide-in equivalent of AdminSidebar for < md, opened from the hamburger
// button in AdminTopBar — the desktop sidebar is `hidden md:flex`, so
// without this the admin nav was entirely unreachable on a phone.
export function MobileNavDrawer({
  groups,
  open,
  onClose,
}: {
  groups: AdminNavGroup[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <button aria-label="Close menu" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <span className="text-sm font-extrabold tracking-tight text-red-700">OBIAS Admin</span>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            {icons.close}
          </button>
        </div>
        <SidebarNav groups={groups} onNavigate={onClose} />
      </div>
    </div>
  );
}

// Jump-to-page search: matches the reference dashboard's search field, but
// scoped to what the admin shell can actually do without a backend search
// endpoint — filtering the caller's own nav items, not users/courses/exams.
function NavSearch({ items }: { items: AdminNavItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 6);
  }, [items, query]);

  const go = (href: string) => {
    router.push(href);
    setQuery('');
    setFocused(false);
  };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        {icons.search}
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) go(matches[0].href);
        }}
        placeholder="Jump to a section..."
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-600 focus:outline-none"
      />
      {focused && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((item) => (
            <button
              key={item.href}
              onClick={() => go(item.href)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="text-slate-400">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarMenu({ email, role }: { email: string; role: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-700 text-xs font-semibold text-white">
          {email.charAt(0).toUpperCase()}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="max-w-[10rem] truncate text-sm font-medium text-slate-900">{email}</div>
          <div className="text-[11px] text-slate-400">{role}</div>
        </div>
        <span className="hidden text-slate-400 sm:block">{icons.chevronDown}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
            <div className="truncate text-sm font-medium text-slate-900">{email}</div>
            <div className="text-[11px] text-slate-400">{role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            {icons.logout}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminTopBar({
  navItems,
  unreadCount,
  email,
  role,
  onMenuClick,
}: {
  navItems: AdminNavItem[];
  unreadCount: number;
  email: string;
  role: string;
  onMenuClick: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:px-6 md:py-3">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 md:hidden"
      >
        {icons.menu}
      </button>

      <span className="text-sm font-semibold text-red-700 md:hidden">OBIAS</span>

      <div className="hidden flex-1 md:flex">
        <NavSearch items={navItems} />
      </div>
      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-100"
        >
          {icons.bell}
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
        <AvatarMenu email={email} role={role} />
      </div>
    </div>
  );
}
