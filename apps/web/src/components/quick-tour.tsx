'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import type { GuidePortal } from '@/lib/user-guides';

// A short spotlight walk through a portal's shell: nav, search, notifications,
// the role guide card and the account menu. Steps point at `data-tour="..."`
// attributes on those elements rather than at selectors, and a step whose
// element isn't on screen (the desktop sidebar on a phone, a hidden guide
// card, a section the role lacks) is simply left out, so one list per portal
// covers every breakpoint and role.
//
// Anything can start the tour with startQuickTour(); the <QuickTour> mounted
// in each portal layout listens for it. It also offers itself once per
// account per portal on that portal's home page.

interface TourStep {
  /** `data-tour` value to spotlight. Omit for a centered intro card. */
  target?: string;
  title: string;
  body: string;
}

const TOURS: Record<GuidePortal, TourStep[]> = {
  dashboard: [
    {
      title: 'Welcome to OBIAS Admin',
      body: 'A one-minute look at where things are. Use Next, or the arrow keys, to move along.',
    },
    {
      target: 'nav',
      title: 'Your sections',
      body: 'The sidebar lists only the sections your role can open. Grouped sections expand to show their pages.',
    },
    {
      target: 'menu',
      title: 'Your sections',
      body: 'Tap here to open the menu. It lists only the sections your role can open.',
    },
    {
      target: 'search',
      title: 'Jump to a section',
      body: 'Type part of a page name and press Enter to go straight there.',
    },
    {
      target: 'notifications',
      title: 'Notifications',
      body: 'The badge counts your unread notifications. Open it to read them and mark them as read.',
    },
    {
      target: 'guide-card',
      title: 'Your role guide',
      body: 'The tasks your role does most, step by step. You can hide this card; the full guide stays in the account menu.',
    },
    {
      target: 'account',
      title: 'Your account',
      body: 'Open this menu for the user guide, to take this tour again, or to sign out.',
    },
  ],
  instructor: [
    {
      title: 'Welcome to the Instructor Portal',
      body: 'A one-minute look at where things are. Use Next, or the arrow keys, to move along.',
    },
    {
      target: 'nav',
      title: 'Your sections',
      body: 'Today, Classes, Attendance and Grading. You only see the sections your account can use.',
    },
    {
      target: 'notifications',
      title: 'Notifications',
      body: 'Open the bell to read recent notifications and mark them as read without leaving the page.',
    },
    {
      target: 'guide-card',
      title: 'Your role guide',
      body: 'The tasks you do most, step by step. You can hide this card; the full guide stays in the Guide tab.',
    },
    {
      target: 'account',
      title: 'Your account',
      body: 'Open this menu for the user guide, to take this tour again, or to sign out.',
    },
  ],
  student: [
    {
      title: 'Welcome to your student portal',
      body: 'A one-minute look at where things are. Use Next, or the arrow keys, to move along.',
    },
    {
      target: 'nav',
      title: 'Your study pages',
      body: 'Courses, video lessons, exams, schedule and progress are all here. Help and settings sit at the bottom.',
    },
    {
      target: 'tabs',
      title: 'The pages you use most',
      body: 'Home, Learn, Exams, Schedule and Profile are one tap away. The menu button at the top has everything else.',
    },
    {
      target: 'search',
      title: 'Find a page',
      body: 'Search for exams, schedule, certificates and more, then press Enter.',
    },
    {
      target: 'notifications',
      title: 'Notifications',
      body: 'Announcements and updates from your review center appear here. The badge counts unread ones.',
    },
    {
      target: 'guide-card',
      title: 'Your guide',
      body: 'How to do the things students do most, step by step. You can hide this card; the full guide stays in the menu.',
    },
    {
      target: 'account',
      title: 'Your account',
      body: 'Your profile, settings, user guide and help are in this menu. You can take this tour again from here too.',
    },
  ],
};

const START_EVENT = 'obias:quick-tour';

export function startQuickTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

// --- Step resolution and placement ---------------------------------------------

interface ResolvedStep extends TourStep {
  el: HTMLElement | null;
}

function visibleTarget(name: string) {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  return Array.from(all).find((el) => el.getClientRects().length > 0) ?? null;
}

function resolveSteps(steps: TourStep[]): ResolvedStep[] {
  return steps.flatMap((step): ResolvedStep[] => {
    if (!step.target) return [{ ...step, el: null }];
    const el = visibleTarget(step.target);
    return el ? [{ ...step, el }] : [];
  });
}

const GAP = 12;
const MARGIN = 16;
const PAD = 6;

// Below `sm` the card docks to whichever screen edge the target isn't near;
// wider, it sits beside the target on the first side with room.
function cardPosition(rect: DOMRect | null, card: { w: number; h: number }): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: Math.max(MARGIN, (vw - card.w) / 2), top: Math.max(MARGIN, (vh - card.h) / 2) };
  if (vw < 640) {
    return rect.top + rect.height / 2 > vh / 2
      ? { left: MARGIN, right: MARGIN, top: MARGIN }
      : { left: MARGIN, right: MARGIN, bottom: MARGIN };
  }
  const x = (v: number) => Math.min(Math.max(v, MARGIN), vw - card.w - MARGIN);
  const y = (v: number) => Math.min(Math.max(v, MARGIN), vh - card.h - MARGIN);
  const below = rect.bottom + PAD + GAP;
  const above = rect.top - PAD - GAP - card.h;
  const right = rect.right + PAD + GAP;
  const left = rect.left - PAD - GAP - card.w;
  if (below + card.h <= vh - MARGIN) return { left: x(rect.left), top: below };
  if (above >= MARGIN) return { left: x(rect.left), top: above };
  if (right + card.w <= vw - MARGIN) return { left: right, top: y(rect.top) };
  if (left >= MARGIN) return { left, top: y(rect.top) };
  return { left: x(rect.left), top: vh - card.h - MARGIN };
}

// --- "Already seen" ------------------------------------------------------------
// Per-viewer convenience, so browser storage is fine. If storage is
// unavailable the tour is treated as seen: better to never auto-offer than
// to offer it on every visit.

function seenKey(portal: GuidePortal, userId: string | undefined) {
  return `obias.quickTour.seen.${portal}.${userId ?? 'anon'}`;
}

function hasSeen(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Storage unavailable: nothing to persist.
  }
}

// --- Component -------------------------------------------------------------------

export function QuickTour({ portal, autoStart = false }: { portal: GuidePortal; autoStart?: boolean }) {
  const { user } = useAuth();
  const key = seenKey(portal, user?.id);
  const [steps, setSteps] = useState<ResolvedStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<{ el: HTMLElement; rect: DOMRect } | null>(null);
  const [cardSize, setCardSize] = useState({ w: 320, h: 200 });
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const open = steps !== null && steps.length > 0;
  const step = open ? steps[Math.min(index, steps.length - 1)] : null;
  const isLast = open && index >= steps.length - 1;

  const start = useCallback(() => {
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSteps(resolveSteps(TOURS[portal]));
    setIndex(0);
    markSeen(key);
  }, [portal, key]);

  const close = useCallback(() => {
    setSteps(null);
    setMeasured(null);
    const el = restoreFocus.current;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, []);

  const next = useCallback(() => {
    if (isLast) close();
    else setIndex((i) => i + 1);
  }, [isLast, close]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    window.addEventListener(START_EVENT, start);
    return () => window.removeEventListener(START_EVENT, start);
  }, [start]);

  // First visit to the portal's home page: offer the tour once, after the
  // shell has settled.
  useEffect(() => {
    if (!autoStart || !user || hasSeen(key)) return;
    const timer = window.setTimeout(start, 700);
    return () => window.clearTimeout(timer);
  }, [autoStart, user, key, start]);

  // Follow the target through scrolling and resizing. A resize can cross a
  // breakpoint (sidebar ↔ menu button), so steps are re-resolved too, keeping
  // the reader on the same step when it survives.
  const el = step?.el ?? null;
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el) setMeasured({ el, rect: el.getBoundingClientRect() });
      });
    };
    const onResize = () => {
      const current = step;
      const resolved = resolveSteps(TOURS[portal]);
      const same = resolved.findIndex((s) => s.target === current?.target && s.title === current?.title);
      setSteps(resolved);
      setIndex((i) => (same >= 0 ? same : Math.min(i, resolved.length - 1)));
    };
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, el, step, portal]);

  useEffect(() => {
    const card = cardRef.current;
    if (!open || !card) return;
    const observer = new ResizeObserver(() => setCardSize({ w: card.offsetWidth, h: card.offsetHeight }));
    observer.observe(card);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (open) cardRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  // Escape closes, arrows step, and Tab stays inside the card while it's open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Tab' && cardRef.current) {
        const focusable = Array.from(cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === cardRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !cardRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, next, back]);

  if (!open || !step) return null;

  const rect = el && measured?.el === el ? measured.rect : null;
  const waiting = el !== null && rect === null;

  return createPortal(
    <>
      {/* Swallows clicks so the page underneath can't change mid-tour. */}
      <div aria-hidden className={`fixed inset-0 z-[60] ${rect ? '' : 'bg-slate-900/55'}`} />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[61] rounded-xl shadow-[0_0_0_9999px_rgb(15_23_42/0.55)] ring-2 ring-white transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={`fixed z-[62] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_48px_-16px_rgb(15_23_42/0.45)] outline-none sm:w-80 ${
          waiting ? 'invisible' : ''
        }`}
        style={cardPosition(rect, cardSize)}
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-red-600 via-red-600 to-amber-400" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
          Quick tour · {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="mt-1 text-base font-semibold leading-snug text-slate-900">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={close}
            className="mr-auto rounded px-1 text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            {isLast ? 'Close' : 'Skip tour'}
          </button>
          {index > 0 && (
            <button
              type="button"
              onClick={back}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-red-700 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
