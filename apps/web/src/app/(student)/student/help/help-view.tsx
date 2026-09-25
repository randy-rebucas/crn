'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { type PublicSettings, phonesOf } from '@/lib/public-settings';
import { Panel, StudentPageHero, StudentShell, icons } from '@/components/student-ui';

// Client half of /student/help: the shared icon set lives in a client module,
// so the page renders here while page.tsx fetches settings and FAQ on the
// server.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const PORTAL_FAQS = [
  {
    q: 'I missed a scheduled class or exam — what do I do?',
    a: 'Reach out to your registrar or program coordinator directly; they can advise on makeup sessions or reschedules.',
  },
  {
    q: 'My enrollment status looks wrong.',
    a: 'Enrollment status is set by the registrar as your requirements and payments are verified. Contact your branch office if it looks stale.',
  },
  {
    q: 'I can’t see a course, lesson, or exam I expect to have access to.',
    a: 'Content only appears once it’s published for your program and you have an active enrollment for the current batch.',
  },
  {
    q: 'Why does my exam say “Awaiting results”?',
    a: 'Some exams release scores only after they’re graded. Your score appears on the exam and in Performance as soon as grading is done.',
  },
  {
    q: 'I ran out of attempts on an exam.',
    a: 'Each exam sets its own attempt limit, and the portal can’t add more. If you think you need another try, talk to your program coordinator.',
  },
  {
    q: 'How can an employer or the licensing board check my certificate?',
    a: 'Open Certificates and copy the verification link. Anyone with the link can open a public page showing only your certificate number, name, program, and issue date.',
  },
  {
    q: 'Why are some videos marked “Opened” but not others?',
    a: 'The portal remembers which videos you opened on this device only. It isn’t a completion record, and it won’t carry over to another phone or browser.',
  },
];

const TOPICS = [
  { label: 'Classes and schedule', hint: 'Times, rooms, and attendance', href: '/student/schedule', icon: icons.schedule, tone: 'bg-blue-50 text-blue-700' },
  { label: 'Exams and results', hint: 'Open exams, scores, and retakes', href: '/student/progress', icon: icons.exams, tone: 'bg-red-50 text-red-700' },
  { label: 'Lessons and materials', hint: 'Courses, handouts, and videos', href: '/student/learn', icon: icons.learn, tone: 'bg-teal-50 text-teal-700' },
  { label: 'Certificates', hint: 'Your path and verification links', href: '/student/certificates', icon: icons.certificate, tone: 'bg-amber-50 text-amber-700' },
  { label: 'Enrollment and payments', hint: 'Status updates from the registrar', href: '/student/notifications', icon: icons.bell, tone: 'bg-violet-50 text-violet-700' },
  { label: 'Your profile', hint: 'Personal and contact details', href: '/student/profile', icon: icons.profile, tone: 'bg-slate-100 text-slate-700' },
];

const glyphs = {
  phone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M5 4.5h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={2.3} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={3.5} y={3.5} width={17} height={17} rx={4} stroke="currentColor" strokeWidth={1.7} />
      <path d="M15 8.5h-1.5a2 2 0 0 0-2 2v10M9.5 13h5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  ),
};

function FaqList({ items, idPrefix }: { items: { id: string; q: React.ReactNode; a: React.ReactNode }[]; idPrefix: string }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      {items.map((item) => (
        <li key={item.id}>
          <details className="group" id={`${idPrefix}-${item.id}`}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold leading-snug text-slate-900">{item.q}</span>
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45 group-open:bg-red-700 group-open:text-white motion-reduce:transition-none"
              >
                {glyphs.plus}
              </span>
            </summary>
            <div className="max-w-[68ch] px-4 pb-4 text-sm leading-relaxed text-slate-600 sm:px-5 [&_a]:font-semibold [&_a]:text-red-700 [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc">
              {item.a}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function HelpView({ settings, centerFaq }: { settings: PublicSettings; centerFaq: FaqItem[] }) {
  const phones = phonesOf(settings);
  const mapHref = settings.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}` : null;

  return (
    <StudentShell>
      <StudentPageHero
        badge={icons.help}
        title="Help &amp; Support"
        meta={<span>Common questions, where to find things, and how to reach the center.</span>}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-8">
          <section aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="mb-1 flex items-center gap-2.5 px-1 text-lg font-semibold tracking-wide text-slate-900">
              <span className="text-red-700">{icons.search}</span>
              Find It in the Portal
            </h2>
            <p className="mb-3 px-1 text-sm text-slate-500">Most questions are answered on one of these pages.</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {TOPICS.map((t) => (
                <li key={t.href + t.label}>
                  <Link
                    href={t.href}
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}>{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                      <span className="block truncate text-xs text-slate-500">{t.hint}</span>
                    </span>
                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-red-700 motion-reduce:transition-none">
                      {icons.arrowRight}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="portal-faq-heading">
            <h2 id="portal-faq-heading" className="mb-3 flex items-center gap-2.5 px-1 text-lg font-semibold tracking-wide text-slate-900">
              <span className="text-red-700">{icons.help}</span>
              Using the Student Portal
              <span className="text-sm font-normal text-slate-400">· {PORTAL_FAQS.length}</span>
            </h2>
            <FaqList idPrefix="portal" items={PORTAL_FAQS.map((f, i) => ({ id: String(i), q: f.q, a: <p>{f.a}</p> }))} />
          </section>

          {centerFaq.length > 0 && (
            <section aria-labelledby="center-faq-heading">
              <h2 id="center-faq-heading" className="mb-3 flex items-center gap-2.5 px-1 text-lg font-semibold tracking-wide text-slate-900">
                <span className="text-red-700">{icons.megaphone}</span>
                About the Review Center
                <span className="text-sm font-normal text-slate-400">· {centerFaq.length}</span>
              </h2>
              <FaqList
                idPrefix="center"
                items={centerFaq.map((f) => ({ id: f.id, q: f.question, a: <ReactMarkdown>{f.answer}</ReactMarkdown> }))}
              />
            </section>
          )}
        </div>

        <aside className="order-first grid min-w-0 gap-5 xl:sticky xl:top-20 xl:order-none" aria-label="Contact the center">
          <Panel title="Contact the Center" icon={glyphs.phone}>
            <p className="-mt-1 mb-4 text-sm leading-relaxed text-slate-600">
              For anything account-specific — enrollment, payments, schedules, or exam issues — contact your registrar or program
              coordinator. They can see your record and act on it directly.
            </p>

            {phones.length > 0 && (
              <div className="rounded-xl bg-slate-900 p-4 text-white">
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-300 [&_svg]:h-4 [&_svg]:w-4">
                  {glyphs.phone} Call or text
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 xl:grid-cols-1">
                  {phones.map((p) => (
                    <li key={p}>
                      <a
                        href={`tel:${p.replace(/\s+/g, '')}`}
                        className="flex min-h-[40px] items-center rounded-lg px-2 font-[family-name:var(--font-heading)] text-lg font-semibold tabular-nums tracking-wide text-amber-300 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
                      >
                        {p}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="mt-4 space-y-1">
              {settings.supportEmail && (
                <li>
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">{glyphs.mail}</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-slate-500">Email</span>
                      <span className="block text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                        {settings.supportEmail.split('@')[0]}@<wbr />
                        {settings.supportEmail.split('@').slice(1).join('@')}
                      </span>
                    </span>
                  </a>
                </li>
              )}
              {settings.facebookPageName && (
                <li>
                  {settings.facebookUrl ? (
                    <a
                      href={settings.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{glyphs.facebook}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-slate-500">Facebook page</span>
                        <span className="block text-sm font-semibold text-slate-900">{settings.facebookPageName}</span>
                      </span>
                      <span className="text-slate-400">{icons.external}</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{glyphs.facebook}</span>
                      <span className="min-w-0">
                        <span className="block text-xs text-slate-500">Facebook page</span>
                        <span className="block text-sm font-semibold text-slate-900">{settings.facebookPageName}</span>
                      </span>
                    </div>
                  )}
                </li>
              )}
              {settings.address && (
                <li>
                  <a
                    href={mapHref!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">{glyphs.pin}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-slate-500">Visit the center</span>
                      <span className="block text-sm font-semibold leading-snug text-slate-900">{settings.address}</span>
                    </span>
                    <span className="text-slate-400">{icons.external}</span>
                    <span className="sr-only">(opens map in a new tab)</span>
                  </a>
                </li>
              )}
            </ul>
          </Panel>
        </aside>
      </div>
    </StudentShell>
  );
}
