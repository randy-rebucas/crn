'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { type Enrollment, useMyEnrollments, useMyStudentProfile } from '@/lib/student-hooks';
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

interface Certificate {
  id: string;
  studentId: string;
  programId: string;
  certificateNumber: string;
  qrToken: string;
  issuedAt: string;
  program?: { name: string };
}

// GET /v1/certificates is organization-wide with no studentId filter
// server-side (`certificates.service.findAllForOrganization`) — filtered
// client-side to this student's own certificates.
//
// A certificate is only ever issued against a COMPLETED enrollment, so the
// "path" below is derived from the student's real enrollment statuses: it
// shows how far each program is from producing one, never a guessed
// percentage.

const DAY_MS = 86_400_000;

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Public verification page on the site (app/(marketing)/verify/[token]),
// backed by GET /v1/certificates/verify/:qrToken: no login, and it shows
// only the number, holder, program, and issue date.
function verifyPath(qrToken: string) {
  return `/verify/${encodeURIComponent(qrToken)}`;
}

// ---------------------------------------------------------------------------
// Path to certification
// ---------------------------------------------------------------------------

const STAGES = ['Applied', 'Approved', 'Paid', 'Enrolled', 'Completed', 'Certified'] as const;

// What the student is waiting on at each stage, for the one-line summary.
const NEXT_STEP = ['Submit your application', 'Get approved', 'Verify your payment', 'Get enrolled', 'Complete the program', 'Receive your certificate'];

// How many stages are done for an enrollment status, plus a note when the
// current stage is blocked on the student.
function stageOf(status: string, certified: boolean): { done: number; note?: string; stopped?: boolean } {
  if (certified) return { done: 6 };
  switch (status) {
    case 'DRAFT':
      return { done: 0, note: 'Application not yet submitted' };
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return { done: 1, note: 'Your application is being reviewed' };
    case 'REQUIREMENTS_INCOMPLETE':
      return { done: 1, note: 'Requirements are incomplete. Contact the center to finish your application.' };
    case 'APPROVED':
      return { done: 2, note: 'Approved. Settle your payment to continue.' };
    case 'PAYMENT_PENDING':
      return { done: 2, note: 'Payment submitted, waiting for verification' };
    case 'PAYMENT_VERIFIED':
      return { done: 3, note: 'Payment verified. You’ll be enrolled in a batch soon.' };
    case 'ENROLLED':
      return { done: 4, note: 'Finish your review program to complete it' };
    case 'COMPLETED':
      return { done: 5, note: 'Program complete. Your certificate is being prepared.' };
    case 'CANCELLED':
    case 'REJECTED':
      return { done: 0, stopped: true, note: status === 'CANCELLED' ? 'This enrollment was cancelled' : 'This application was not approved' };
    default:
      return { done: 0 };
  }
}

function reviewWindow(batch: NonNullable<Enrollment['batch']>, now: number) {
  const start = new Date(batch.startDate).getTime();
  if (!batch.endDate) return null;
  const end = new Date(batch.endDate).getTime();
  const pct = Math.round(Math.min(1, Math.max(0, (now - start) / (end - start))) * 100);
  const label =
    now < start
      ? `Starts ${shortDate(batch.startDate)}`
      : now >= end
        ? `Review period ended ${shortDate(batch.endDate)}`
        : `${Math.ceil((end - now) / DAY_MS)} days left in your review period`;
  return { pct, label, start: batch.startDate, end: batch.endDate };
}

function Stepper({ done, stopped }: { done: number; stopped?: boolean }) {
  return (
    <ol className="grid grid-cols-6" aria-label="Certification steps">
      {STAGES.map((stage, i) => {
        const complete = !stopped && i < done;
        const current = !stopped && i === done;
        return (
          <li key={stage} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute right-1/2 top-[13px] h-[3px] w-full -translate-y-1/2 rounded-full ${
                  complete || current ? 'bg-red-700' : 'bg-slate-200'
                } ${current ? 'bg-gradient-to-r from-red-700 to-amber-400' : ''}`}
              />
            )}
            <span
              className={`relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-bold tabular-nums ring-4 ring-white ${
                complete
                  ? i === 5
                    ? 'bg-amber-400 text-red-900'
                    : 'bg-red-700 text-white'
                  : current
                    ? 'bg-white text-red-700 outline-2 outline-red-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {complete ? (
                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                  <path d="m5 10.5 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`mt-2 hidden text-[10.5px] leading-tight sm:block ${
                current ? 'font-semibold text-slate-900' : complete ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              {stage}
            </span>
            <span className="sr-only">{complete ? ' (done)' : current ? ' (current step)' : ' (not yet)'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PathCard({ enrollment, certified, now }: { enrollment: Enrollment; certified: boolean; now: number }) {
  const stage = stageOf(enrollment.status, certified);
  const period = enrollment.batch && !certified && !stage.stopped ? reviewWindow(enrollment.batch, now) : null;
  const currentLabel = stage.done >= 6 ? 'Certificate issued' : `Up next: ${NEXT_STEP[stage.done]}`;

  return (
    <li className="rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 [&_svg]:h-[22px] [&_svg]:w-[22px]">
          {programGlyph(enrollment.program.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold text-slate-900">{enrollment.program.name}</h3>
            <StatusBadge status={enrollment.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {enrollment.batch ? enrollment.batch.name : 'Not yet assigned to a batch'}
            {!stage.stopped && (
              <span className="sm:hidden">
                {' '}
                · <span className="font-semibold text-slate-700">{currentLabel}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <div className={`mt-5 ${stage.stopped ? 'opacity-50' : ''}`}>
        <Stepper done={stage.done} stopped={stage.stopped} />
      </div>

      {stage.note && (
        <p
          className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
            stage.stopped || enrollment.status === 'REQUIREMENTS_INCOMPLETE'
              ? 'bg-amber-50 text-amber-900'
              : 'bg-slate-50 text-slate-600'
          }`}
        >
          <span className="mt-px shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
            {stage.stopped || enrollment.status === 'REQUIREMENTS_INCOMPLETE' ? icons.help : icons.certificate}
          </span>
          {stage.note}
        </p>
      )}

      {period && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <span className="font-semibold text-slate-700">{period.label}</span>
            <span className="tabular-nums text-slate-500">
              {shortDate(period.start)} – {shortDate(period.end)}
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Review period elapsed"
            aria-valuenow={period.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-700" style={{ width: `${Math.max(period.pct, 2)}%` }} />
          </div>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Earned certificate, drawn as the document itself
// ---------------------------------------------------------------------------

function CopyLink({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2200);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-red-800 transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
    >
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : 'Copy verification link'}
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Verification link copied to clipboard' : state === 'failed' ? 'Could not copy the link' : ''}
      </span>
    </button>
  );
}

function CertificateDocument({ certificate, holder }: { certificate: Certificate; holder: string }) {
  const programName = certificate.program?.name ?? 'Review program';
  return (
    <article
      aria-label={`Certificate ${certificate.certificateNumber}`}
      className="relative overflow-hidden rounded-2xl bg-[#fdf6e9] p-2 shadow-[0_14px_32px_-22px_rgb(120_53_15/0.55)] ring-1 ring-amber-200"
    >
      {/* Double rule frame, like the printed certificate's border. */}
      <div className="relative rounded-xl border-2 border-red-800/80 p-1">
        <div className="relative overflow-hidden rounded-lg border border-amber-400/80 px-5 pb-5 pt-6 sm:px-7">
          <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/40" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-[0.18em] text-red-800">
                Certificate of Completion
              </p>
              <p className="mt-3 text-xs text-slate-600">Awarded to</p>
              <p className="font-[family-name:var(--font-heading)] text-2xl font-bold uppercase leading-tight tracking-wide text-slate-900 [text-wrap:balance]">
                {holder}
              </p>
              <p className="mt-2 text-xs text-slate-600">for completing</p>
              <p className="text-base font-semibold leading-snug text-red-800 [text-wrap:balance]">{programName}</p>
            </div>

            {/* Seal */}
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-400 text-red-900 ring-4 ring-amber-200 sm:h-20 sm:w-20 [&_svg]:h-8 [&_svg]:w-8 sm:[&_svg]:h-9 sm:[&_svg]:w-9">
              <span aria-hidden className="absolute inset-1.5 rounded-full border border-dashed border-red-900/40" />
              {icons.certificate}
            </span>
          </div>

          <dl className="relative mt-5 grid grid-cols-1 gap-3 border-t border-amber-300/70 pt-4 text-xs min-[420px]:grid-cols-2 min-[420px]:gap-4">
            <div>
              <dt className="text-slate-500">Certificate no.</dt>
              <dd className="mt-0.5 break-words font-semibold tabular-nums text-slate-900">{certificate.certificateNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Issued</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                <time dateTime={certificate.issuedAt}>{longDate(certificate.issuedAt)}</time>
              </dd>
            </div>
          </dl>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <CopyLink path={verifyPath(certificate.qrToken)} />
            <a
              href={verifyPath(certificate.qrToken)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-red-700 px-3 text-xs font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              View public record
              {icons.external}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyCertificate() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-amber-300 bg-[#fdf6e9]/60 px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-amber-600 ring-4 ring-amber-100 [&_svg]:h-8 [&_svg]:w-8">
        {icons.certificate}
      </span>
      <p className="font-[family-name:var(--font-heading)] text-lg font-bold uppercase tracking-wide text-slate-900">No certificates yet</p>
      <p className="max-w-[42ch] text-sm text-slate-600">
        When you complete a review program, the center issues your certificate here, with a link employers and licensing boards can use to verify it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StudentCertificatesPage() {
  const [now] = useState(() => Date.now());
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();

  const certificates = useQuery<Certificate[]>({
    queryKey: ['my-certificates', profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async () => {
      const { data } = await apiClient.get<Certificate[]>('/v1/certificates');
      return data
        .filter((c) => c.studentId === profile.data!.id)
        .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
    },
  });

  // A user with no student profile can't have certificates or enrollments;
  // both queries stay disabled, so resolve them to empty lists here.
  const noProfile = profile.isSuccess && !profile.data;
  const certs = certificates.data ?? (noProfile ? [] : undefined);
  const enrollmentList = enrollments.data ?? (noProfile ? [] : undefined);

  const holder = profile.data ? `${profile.data.user.firstName} ${profile.data.user.lastName}` : 'Student';
  const certifiedPrograms = new Set((certs ?? []).map((c) => c.programId));
  const paths = (enrollmentList ?? []).slice().sort((a, b) => {
    // Live programs first, then finished, then stopped.
    const rank = (e: Enrollment) => (certifiedPrograms.has(e.programId) ? 2 : ['CANCELLED', 'REJECTED'].includes(e.status) ? 3 : 1);
    return rank(a) - rank(b);
  });
  const inProgress = paths.filter((e) => !certifiedPrograms.has(e.programId) && !['CANCELLED', 'REJECTED'].includes(e.status)).length;
  const latest = certs?.[0];
  const remaining = paths
    .map((e) => stageOf(e.status, certifiedPrograms.has(e.programId)))
    .filter((st) => !st.stopped && st.done < 6)
    .map((st) => 6 - st.done);
  const stepsToGo = remaining.length > 0 ? Math.min(...remaining) : null;

  const loadingCerts = profile.isLoading || certificates.isLoading;
  const dash = <span className="text-slate-300">—</span>;

  return (
    <StudentShell>
      <StudentPageHero
        badge={icons.certificate}
        badgeTone="bg-amber-400 text-red-900 ring-4 ring-amber-100"
        title="Certificates"
        meta={<span>Certificates you&apos;ve earned across your programs.</span>}
      >
        <HeroFigure
          icon={icons.certificate}
          tone="bg-amber-50 text-amber-700"
          value={loadingCerts ? dash : (certs?.length ?? dash)}
          label="Certificates earned"
        />
        <HeroFigure
          icon={icons.learn}
          tone="bg-red-50 text-red-700"
          value={enrollments.isLoading ? dash : inProgress}
          label={inProgress === 1 ? 'Program in progress' : 'Programs in progress'}
        />
        <HeroFigure
          icon={icons.schedule}
          tone="bg-blue-50 text-blue-700"
          value={latest ? new Date(latest.issuedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : dash}
          label="Latest issued"
        />
        <HeroFigure
          icon={icons.progress}
          tone="bg-emerald-50 text-emerald-700"
          value={enrollments.isLoading || stepsToGo === null ? dash : stepsToGo}
          label={stepsToGo === 1 ? 'Step to your next certificate' : 'Steps to your next certificate'}
        />
      </StudentPageHero>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:items-start">
        <section aria-labelledby="earned-heading" className="min-w-0">
          <h2 id="earned-heading" className="mb-3 flex items-center gap-2.5 px-1 text-lg font-semibold tracking-wide text-slate-900">
            <span className="text-red-700">{icons.certificate}</span>
            Earned
            {certs && certs.length > 0 && (
              <span className="text-sm font-normal text-slate-400">· {certs.length}</span>
            )}
          </h2>

          {loadingCerts && <SkeletonRows count={1} className="h-64" />}
          {(profile.isError || certificates.isError) && (
            <PanelMessage tone="error">Couldn&apos;t load your certificates. Refresh the page to try again.</PanelMessage>
          )}
          {certs && certs.length === 0 && <EmptyCertificate />}
          {certs && certs.length > 0 && (
            <ul className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {certs.map((c) => (
                <li key={c.id}>
                  <CertificateDocument certificate={c} holder={holder} />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
            <span className="mt-px shrink-0 text-slate-400 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
              {icons.help}
            </span>
            A verification link shows only your certificate number, name, program, and issue date. Share it with employers or licensing boards who need proof of completion.
          </p>
        </section>

        <Panel title="Path to Certification" icon={icons.progress} action={<PanelLink href="/student/progress">Performance</PanelLink>}>
          {enrollments.isLoading && <SkeletonRows count={2} className="h-40" />}
          {enrollments.isError && <PanelMessage tone="error">Couldn&apos;t load your enrollments.</PanelMessage>}
          {enrollmentList && paths.length === 0 && (
            <PanelMessage>
              <span>You don&apos;t have an enrollment yet.</span>
              <Link href="/student/help" className="font-semibold text-red-700 underline underline-offset-4">
                Ask about enrolling
              </Link>
            </PanelMessage>
          )}
          {paths.length > 0 && (
            <ul className="space-y-4">
              {paths.map((e) => (
                <PathCard key={e.id} enrollment={e} certified={certifiedPrograms.has(e.programId)} now={now} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </StudentShell>
  );
}
