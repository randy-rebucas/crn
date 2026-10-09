'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth-context';
import { type GuidePortal, type GuideTask, type RoleGuide, genericGuide, guidesForRoles } from '@/lib/user-guides';
import { icons } from '@/components/student-ui';

// Role guides for all three portals. Content lives in lib/user-guides.ts;
// this file only decides which guide(s) the signed-in user gets and renders
// them. A task whose permission the account lacks is left out, so a system
// role an admin has since narrowed never shows steps for pages it can't open.

const NO_PAGES: { label: string; href: string }[] = [];

function useGuides(portal: GuidePortal, fallbackPages = NO_PAGES) {
  const { user, hasPermission } = useAuth();
  return useMemo(() => {
    const written = guidesForRoles(user?.roles ?? [], portal);
    const guides = written.length > 0 ? written : [genericGuide(fallbackPages)];
    return guides.map((g) => ({
      ...g,
      tasks: g.tasks.filter((t) => !t.permission || hasPermission(t.permission)),
    }));
  }, [user, hasPermission, portal, fallbackPages]);
}

// --- "Hide from my dashboard" ---------------------------------------------
// A per-viewer convenience only, so browser storage is fine; any read/write
// failure (private mode, blocked storage) just means the card stays visible.

const listeners = new Set<() => void>();

function storageKey(userId: string | undefined) {
  return `obias.guideCard.hidden.${userId ?? 'anon'}`;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function useGuideCardHidden() {
  const { user } = useAuth();
  const key = storageKey(user?.id);
  const hidden = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) === '1';
      } catch {
        return false;
      }
    },
    () => false,
  );
  const setHidden = useCallback(
    (value: boolean) => {
      try {
        if (value) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
      } catch {
        // Storage unavailable: nothing to persist.
      }
      listeners.forEach((cb) => cb());
    },
    [key],
  );
  return [hidden, setHidden] as const;
}

// --- Pieces ------------------------------------------------------------------

function TaskCard({ task, index }: { task: GuideTask; index: number }) {
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-semibold tabular-nums text-red-700"
        >
          {index + 1}
        </span>
        <h3 className="min-w-0 flex-1 pt-1 text-base font-semibold leading-snug text-slate-900">{task.title}</h3>
      </div>
      <ol className="mt-3 flex-1 list-decimal space-y-1.5 pl-[3.25rem] text-sm leading-relaxed text-slate-600 marker:text-slate-400">
        {task.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {task.href && (
        <Link
          href={task.href}
          className="mt-4 inline-flex items-center gap-1 self-start rounded pl-11 text-sm font-semibold text-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Open page<span className="sr-only">: {task.title}</span>
          <span aria-hidden className="[&_svg]:h-4 [&_svg]:w-4">
            {icons.arrowRight}
          </span>
        </Link>
      )}
    </li>
  );
}

function RoleTabs({ guides, active, onChange }: { guides: RoleGuide[]; active: number; onChange: (i: number) => void }) {
  if (guides.length < 2) return null;
  return (
    <div role="group" aria-label="Your roles" className="mb-4 flex flex-wrap gap-2">
      {guides.map((g, i) => (
        <button
          key={g.key}
          type="button"
          aria-pressed={i === active}
          onClick={() => onChange(i)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
            i === active ? 'bg-red-700 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}

// --- Full guide ----------------------------------------------------------------

export function UserGuide({
  portal,
  fallbackPages,
  supportHref,
}: {
  portal: GuidePortal;
  /** Pages a custom role can open, for the generic guide. */
  fallbackPages?: { label: string; href: string }[];
  /** Where to send people with questions the guide doesn't answer. */
  supportHref?: string;
}) {
  const guides = useGuides(portal, fallbackPages);
  const [active, setActive] = useState(0);
  const [cardHidden, setCardHidden] = useGuideCardHidden();
  const guide = guides[Math.min(active, guides.length - 1)];

  return (
    <div>
      <section className="relative isolate mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(100deg,#fff_55%,#fffbeb)] p-5 pr-12 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-6 sm:pr-28">
        <div aria-hidden className="absolute inset-y-0 right-0 w-10 bg-amber-300 [clip-path:polygon(70%_0,100%_0,100%_100%,0_100%)] sm:w-24" />
        <div aria-hidden className="absolute inset-y-0 right-0 w-10 bg-red-600 [clip-path:polygon(70%_0,78%_0,8%_100%,0_100%)] sm:w-24" />
        <div className="relative flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-700 text-white [&_svg]:h-7 [&_svg]:w-7">
            {icons.help}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">User guide</p>
            <h1 className="mt-0.5 text-2xl font-bold leading-tight tracking-wide text-slate-900 sm:text-3xl">{guide.name}</h1>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-slate-600">{guide.summary}</p>
          </div>
        </div>
      </section>

      <RoleTabs guides={guides} active={active} onChange={setActive} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-labelledby="guide-tasks-heading" className="min-w-0">
          <h2 id="guide-tasks-heading" className="mb-3 px-1 text-lg font-semibold tracking-wide text-slate-900">
            How to do your work
          </h2>
          {guide.tasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Your account doesn&apos;t have any sections enabled yet. Ask your administrator to add them to your role.
            </p>
          ) : (
            <ol className="grid gap-4 lg:grid-cols-2">
              {guide.tasks.map((task, i) => (
                <TaskCard key={task.title} task={task} index={i} />
              ))}
            </ol>
          )}
        </section>

        <aside className="grid min-w-0 gap-4 xl:sticky xl:top-20" aria-label="About your access">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">What you can see</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{guide.scope}</p>
          </div>

          {guide.tips && guide.tips.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-amber-900">Good to know</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-amber-900/90">
                {guide.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Need something else?</h2>
            <p className="mt-1.5">
              If a page you need is missing, your role doesn&apos;t include it. Ask your administrator to change your access.
            </p>
            {supportHref && (
              <Link href={supportHref} className="mt-2 inline-block font-semibold text-red-700 underline-offset-4 hover:underline">
                Help &amp; support
              </Link>
            )}
            {cardHidden && (
              <button
                type="button"
                onClick={() => setCardHidden(false)}
                className="mt-3 block rounded font-semibold text-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                Show the guide card on my dashboard again
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// --- Dashboard card --------------------------------------------------------------

export function GuideCard({
  portal,
  guideHref,
  fallbackPages,
  className = '',
}: {
  portal: GuidePortal;
  guideHref: string;
  fallbackPages?: { label: string; href: string }[];
  className?: string;
}) {
  const guides = useGuides(portal, fallbackPages);
  const [hidden, setHidden] = useGuideCardHidden();
  if (hidden) return null;

  const guide = guides[0];
  const quick = guide.tasks.slice(0, 3);
  const extraRoles = guides.length - 1;

  return (
    <section
      aria-labelledby="guide-card-heading"
      className={`@container relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5 ${className}`}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-600 to-amber-400" />
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">{icons.help}</span>
          <div className="min-w-0">
            <h2 id="guide-card-heading" className="text-base font-semibold text-slate-900">
              Your role guide
            </h2>
            <p className="truncate text-xs text-slate-500">
              {guide.name}
              {extraRoles > 0 && ` + ${extraRoles} more role${extraRoles === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide the role guide from this dashboard"
          title="Hide (the guide stays in the menu)"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-red-700 [&_svg]:h-4 [&_svg]:w-4"
        >
          {icons.close}
        </button>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-slate-600">{guide.summary}</p>

      {quick.length > 0 && (
        <ol className="mt-4 grid gap-2 @xl:grid-cols-3">
          {quick.map((task, i) => (
            <li key={task.title}>
              <Link
                href={task.href ?? guideHref}
                className="group flex h-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-red-200 hover:bg-red-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600 group-hover:bg-red-700 group-hover:text-white"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800">{task.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <Link
        href={guideHref}
        className="mt-4 inline-flex items-center gap-1 self-start rounded text-sm font-semibold text-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        Read the full guide
        <span aria-hidden className="[&_svg]:h-4 [&_svg]:w-4">
          {icons.arrowRight}
        </span>
      </Link>
    </section>
  );
}
