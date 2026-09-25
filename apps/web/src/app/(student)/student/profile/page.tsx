'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { type Enrollment, pickActiveEnrollment, useMyEnrollments, useMyStudentProfile } from '@/lib/student-hooks';
import { StatusBadge } from '@/components/ui';
import {
  HeroFigure,
  Panel,
  PanelLink,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
  programGlyph,
} from '@/components/student-ui';

// Read-only overview of the student's record. Editing lives in Settings
// (contact details via PATCH /v1/students/me, password, preferences); name,
// email, date of birth, and education are set by the registrar.

const DAY_MS = 86_400_000;

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
  cake: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4.5 20.5v-7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7M3.5 20.5h17M4.5 15.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 11.5V8" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3.5c1 1.2 1 2.3 0 3-1-.7-1-1.8 0-3Z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  ),
  cap: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2M21 9.5V14" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lifebuoy: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={3.4} stroke="currentColor" strokeWidth={1.7} />
      <path d="m6.2 6.2 3.4 3.4M14.4 14.4l3.4 3.4M17.8 6.2l-3.4 3.4M9.6 14.4l-3.4 3.4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
};

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Detail row: icon, label, value — or a "not on file" state with the right
// next step (Settings for editable fields, the registrar for the rest).
// ---------------------------------------------------------------------------

function Detail({
  icon,
  label,
  value,
  editable,
  grid = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | null;
  editable?: boolean;
  grid?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-3.5 ${grid ? '' : 'first:pt-0 last:pb-0'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm">
          {value ? (
            <span className="font-medium text-slate-900 [overflow-wrap:anywhere]">{value}</span>
          ) : editable ? (
            <Link href="/student/settings" className="font-semibold text-red-700 underline-offset-4 hover:underline">
              Add in Settings
            </Link>
          ) : (
            <span className="text-slate-400">Not on file — ask the registrar</span>
          )}
        </dd>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completeness: the six details a student record should carry
// ---------------------------------------------------------------------------

function Completeness({ fields }: { fields: { label: string; done: boolean; editable: boolean }[] }) {
  const done = fields.filter((f) => f.done).length;
  const missingEditable = fields.filter((f) => !f.done && f.editable);

  return (
    <Panel title="Profile Details" icon={icons.quiz}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-slate-600">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{done}</span> of {fields.length} on file
        </p>
        {done === fields.length && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Complete</span>}
      </div>
      <div className="mt-3 flex gap-1" role="img" aria-label={`${done} of ${fields.length} profile details on file`}>
        {fields.map((f) => (
          <span key={f.label} className={`h-2 flex-1 rounded-full ${f.done ? 'bg-emerald-600' : 'bg-slate-200'}`} />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {fields.map((f) => (
          <li key={f.label} className="flex items-center gap-2.5">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${f.done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}
              aria-hidden
            >
              {f.done ? (
                <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3">
                  <path d="m5 10.5 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <span className={f.done ? 'text-slate-700' : 'text-slate-500'}>{f.label}</span>
            <span className="sr-only">{f.done ? '(on file)' : '(missing)'}</span>
          </li>
        ))}
      </ul>
      {missingEditable.length > 0 && (
        <Link
          href="/student/settings"
          className="mt-4 flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Add missing details
          {icons.arrowRight}
        </Link>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

function EnrollmentCard({ e, active, now }: { e: Enrollment; active: boolean; now: number }) {
  const batch = e.batch;
  let period: { pct: number; label: string } | null = null;
  if (batch?.endDate) {
    const start = new Date(batch.startDate).getTime();
    const end = new Date(batch.endDate).getTime();
    const pct = Math.round(Math.min(1, Math.max(0, (now - start) / (end - start))) * 100);
    period = {
      pct,
      label: now < start ? `Starts ${shortDate(batch.startDate)}` : now >= end ? 'Review period ended' : `${Math.ceil((end - now) / DAY_MS)} days left`,
    };
  }

  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5 ${active ? 'border-red-200' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full [&_svg]:h-6 [&_svg]:w-6 ${active ? 'bg-red-700 text-white' : 'bg-red-50 text-red-700'}`}
        >
          {programGlyph(e.program.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="text-base font-semibold leading-snug text-slate-900">{e.program.name}</h3>
            <StatusBadge status={e.status} />
            {active && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Current</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {batch ? batch.name : 'Not yet assigned to a batch'}
            {!Number.isNaN(Date.parse(e.createdAt)) && <> · Applied {shortDate(e.createdAt)}</>}
          </p>
        </div>
      </div>

      {batch && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <span className="tabular-nums text-slate-600">
              {shortDate(batch.startDate)} – {batch.endDate ? shortDate(batch.endDate) : 'open-ended'}
            </span>
            {period && <span className="font-semibold text-slate-700">{period.label}</span>}
          </div>
          {period && (
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={`${e.program.name} review period elapsed`}
              aria-valuenow={period.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-red-700" style={{ width: `${Math.max(period.pct, 2)}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs">
        <PanelLink href="/student/certificates">Path to certification</PanelLink>
        {active && <PanelLink href="/student/learn">Open courses</PanelLink>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StudentProfilePage() {
  const [now] = useState(() => Date.now());
  const { logout } = useAuth();
  const router = useRouter();
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
    router.push('/login');
  };

  const p = profile.data;
  const active = pickActiveEnrollment(enrollments.data);
  const enrollmentList = (enrollments.data ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const initials = p ? `${p.user.firstName.charAt(0)}${p.user.lastName.charAt(0)}`.toUpperCase() : '';
  const dash = <span className="text-slate-300">—</span>;

  const fields = p
    ? [
        { label: 'Mobile number', done: Boolean(p.user.phone), editable: true },
        { label: 'Home address', done: Boolean(p.address), editable: true },
        { label: 'Emergency contact name', done: Boolean(p.emergencyContactName), editable: true },
        { label: 'Emergency contact number', done: Boolean(p.emergencyContactPhone), editable: true },
        { label: 'Date of birth', done: Boolean(p.dateOfBirth), editable: false },
        { label: 'Education background', done: Boolean(p.educationBackground), editable: false },
      ]
    : [];

  return (
    <StudentShell>
      <StudentPageHero
        badge={p ? <span className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-wide sm:text-2xl">{initials}</span> : icons.profile}
        title={p ? `${p.user.firstName} ${p.user.lastName}` : 'Profile'}
        meta={
          p ? (
            <>
              <span className="[overflow-wrap:anywhere]">{p.user.email}</span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span>Student</span>
            </>
          ) : (
            <span>Your student record and enrollments.</span>
          )
        }
      >
        <HeroFigure icon={icons.learn} tone="bg-red-50 text-red-700" value={enrollments.data ? enrollmentList.length : dash} label={enrollmentList.length === 1 ? 'Enrollment' : 'Enrollments'} />
        <HeroFigure
          icon={glyphs.cap}
          tone="bg-amber-50 text-amber-700"
          value={active?.batch ? <span className="text-base">{active.batch.name}</span> : dash}
          label="Current batch"
        />
        <HeroFigure
          icon={icons.schedule}
          tone="bg-blue-50 text-blue-700"
          value={p ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : dash}
          label="Student since"
        />
        <HeroFigure
          icon={icons.quiz}
          tone="bg-emerald-50 text-emerald-700"
          value={p ? `${fields.filter((f) => f.done).length}/${fields.length}` : dash}
          label="Details on file"
        />
      </StudentPageHero>

      {profile.isLoading && <SkeletonRows count={3} className="h-24" />}
      {profile.isError && <PanelMessage tone="error">Couldn&apos;t load your profile. Refresh the page to try again.</PanelMessage>}
      {profile.isSuccess && !p && (
        <PanelMessage>
          <span className="font-semibold text-slate-700">No student record yet</span>
          <span>Your profile appears here once the registrar sets up your student record.</span>
        </PanelMessage>
      )}

      {p && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="grid min-w-0 grid-cols-1 gap-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title="Contact" icon={glyphs.phone} action={<PanelLink href="/student/settings">Edit</PanelLink>}>
                <dl className="divide-y divide-slate-100">
                  <Detail icon={glyphs.mail} label="Email" value={p.user.email} />
                  <Detail icon={glyphs.phone} label="Mobile number" value={p.user.phone} editable />
                  <Detail icon={glyphs.pin} label="Home address" value={p.address} editable />
                </dl>
              </Panel>

              <Panel title="Emergency Contact" icon={glyphs.lifebuoy} action={<PanelLink href="/student/settings">Edit</PanelLink>}>
                <dl className="divide-y divide-slate-100">
                  <Detail icon={icons.profile} label="Name" value={p.emergencyContactName} editable />
                  <Detail
                    icon={glyphs.phone}
                    label="Number"
                    value={
                      p.emergencyContactPhone ? (
                        <a href={`tel:${p.emergencyContactPhone.replace(/\s+/g, '')}`} className="hover:text-red-700 hover:underline">
                          {p.emergencyContactPhone}
                        </a>
                      ) : null
                    }
                    editable
                  />
                </dl>
              </Panel>
            </div>

            <Panel title="Student Record" icon={icons.certificate}>
              <dl className="-my-3.5 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
                <Detail grid icon={icons.profile} label="Full name" value={`${p.user.firstName} ${p.user.lastName}`} />
                <Detail grid icon={glyphs.cake} label="Date of birth" value={p.dateOfBirth ? longDate(p.dateOfBirth) : null} />
                <Detail grid icon={glyphs.cap} label="Education background" value={p.educationBackground} />
                <Detail grid icon={icons.schedule} label="Student since" value={longDate(p.createdAt)} />
              </dl>
              <p className="mt-5 text-xs text-slate-500">
                These are set by the registrar. If something is wrong,{' '}
                <Link href="/student/help" className="font-semibold text-red-700 underline-offset-4 hover:underline">
                  contact the center
                </Link>
                .
              </p>
            </Panel>

            <section aria-labelledby="enrollments-heading">
              <h2 id="enrollments-heading" className="mb-3 flex items-center gap-2.5 px-1 text-lg font-semibold tracking-wide text-slate-900">
                <span className="text-red-700">{icons.learn}</span>
                Enrollments
                {enrollments.data && <span className="text-sm font-normal text-slate-400">· {enrollmentList.length}</span>}
              </h2>
              {enrollments.isLoading && <SkeletonRows count={1} className="h-32" />}
              {enrollments.isError && <PanelMessage tone="error">Couldn&apos;t load your enrollments.</PanelMessage>}
              {enrollments.data && enrollmentList.length === 0 && (
                <PanelMessage>
                  <span className="font-semibold text-slate-700">No enrollments yet</span>
                  <span>You haven&apos;t enrolled in a program yet.</span>
                </PanelMessage>
              )}
              {enrollmentList.length > 0 && (
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {enrollmentList.map((e) => (
                    <EnrollmentCard key={e.id} e={e} active={e.id === active?.id} now={now} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1" aria-label="Account">
            <Completeness fields={fields} />

            <Panel title="Account" icon={icons.settings}>
              <ul className="-mx-2 space-y-0.5">
                {[
                  { href: '/student/settings', label: 'Settings', hint: 'Contact details, password, and alerts', icon: icons.settings },
                  { href: '/student/progress', label: 'My performance', hint: 'Scores, pass rate, and history', icon: icons.progress },
                  { href: '/student/certificates', label: 'Certificates', hint: 'Earned certificates and your path', icon: icons.certificate },
                  { href: '/student/help', label: 'Help & support', hint: 'FAQ and how to reach the center', icon: icons.help },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-[18px] [&_svg]:w-[18px]">{l.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{l.label}</span>
                        <span className="block truncate text-xs text-slate-500">{l.hint}</span>
                      </span>
                      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-red-700 motion-reduce:transition-none">
                        {icons.arrowRight}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
              >
                {icons.logout}
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </Panel>
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
