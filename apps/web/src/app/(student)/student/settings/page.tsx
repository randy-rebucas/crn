'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import {
  useChangePassword,
  useMyPreferences,
  useMyStudentProfile,
  useUpdateMyContactDetails,
  useUpdateMyPreferences,
  type StudentPreferences,
  type StudentProfile,
} from '@/lib/student-hooks';
import { Button, Select, Textarea } from '@/components/ui';
import { Panel, PanelMessage, SkeletonRows, StudentPageHero, StudentShell, icons } from '@/components/student-ui';

// Account settings for the signed-in student: the contact details they own,
// notification/reminder/privacy preferences, their password, and the session. Name, email and date of birth are
// registrar-owned (they print on certificates), so they're shown read-only
// with a pointer to Help rather than as fields that would be refused.

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
  lock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={5} y={10.5} width={14} height={10} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.8 7 9 4.1-1.2 7-4.7 7-9V6.2L12 3.5Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path d="m9 12 2.2 2.2L15.5 10" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function errorMessage(err: unknown, fallback: string) {
  if (!isAxiosError<{ message?: string | string[] }>(err)) return fallback;
  const message = err.response?.data?.message;
  return (Array.isArray(message) ? message.join('. ') : message) ?? fallback;
}

// ---------------------------------------------------------------------------
// Form pieces

function TextField({
  label,
  hint,
  error,
  registration,
  ...inputProps
}: {
  label: string;
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'onChange' | 'onBlur'>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
          error ? 'border-red-500 focus:border-red-600' : 'border-slate-300 focus:border-red-600'
        }`}
        {...inputProps}
        {...registration}
      />
      {(error || hint) && (
        <p id={`${id}-note`} className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function FormFooter({ status, children }: { status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
      <div className="mr-auto min-w-0 text-sm" aria-live="polite">
        {status}
      </div>
      {children}
    </div>
  );
}

function Saved({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
      {glyphs.check}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Contact details

const contactSchema = z.object({
  phone: z.string().trim().max(40, 'Up to 40 characters'),
  address: z.string().trim().max(300, 'Up to 300 characters'),
  emergencyContactName: z.string().trim().max(120, 'Up to 120 characters'),
  emergencyContactPhone: z.string().trim().max(40, 'Up to 40 characters'),
});
type ContactValues = z.infer<typeof contactSchema>;

function toContactValues(p: StudentProfile): ContactValues {
  return {
    phone: p.user.phone ?? '',
    address: p.address ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
  };
}

function ContactForm({ profile }: { profile: StudentProfile }) {
  const update = useUpdateMyContactDetails();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const values = useMemo(() => toContactValues(profile), [profile]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), values });

  // Blank clears the field on the server (null), never leaves it untouched.
  const onSubmit = async (v: ContactValues) => {
    setServerError(null);
    setSaved(false);
    const orNull = (s: string) => (s.trim() === '' ? null : s.trim());
    try {
      const data = await update.mutateAsync({
        phone: orNull(v.phone),
        address: orNull(v.address),
        emergencyContactName: orNull(v.emergencyContactName),
        emergencyContactPhone: orNull(v.emergencyContactPhone),
      });
      reset(toContactValues(data));
      setSaved(true);
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save your details. Try again in a moment.'));
    }
  };

  return (
    <Panel title="Contact Details" icon={glyphs.phone}>
      <p className="-mt-2 mb-4 text-sm text-slate-500">How the center reaches you, and who to call if something happens during class.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate onChange={() => setSaved(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            placeholder="0917 123 4567"
            registration={register('phone')}
            error={errors.phone?.message}
          />
          <div className="sm:col-span-2">
            <label htmlFor="settings-address" className="mb-1 block text-sm font-medium text-slate-700">
              Home address
            </label>
            <Textarea id="settings-address" rows={2} autoComplete="street-address" {...register('address')} />
            {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>}
          </div>
        </div>

        <fieldset className="mt-5 border-t border-slate-100 pt-4">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Emergency contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              autoComplete="off"
              placeholder="e.g. Maria Santos (mother)"
              registration={register('emergencyContactName')}
              error={errors.emergencyContactName?.message}
            />
            <TextField
              label="Phone"
              type="tel"
              autoComplete="off"
              registration={register('emergencyContactPhone')}
              error={errors.emergencyContactPhone?.message}
            />
          </div>
        </fieldset>

        <FormFooter
          status={
            serverError ? <span className="text-red-600">{serverError}</span> : saved && !isDirty ? <Saved>Details saved</Saved> : null
          }
        >
          {isDirty && (
            <Button type="button" variant="ghost" onClick={() => reset(values)} disabled={isSubmitting}>
              Discard
            </Button>
          )}
          <Button type="submit" disabled={!isDirty || isSubmitting} className="min-h-[40px] px-4">
            {isSubmitting ? 'Saving…' : 'Save details'}
          </Button>
        </FormFooter>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Password

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords don’t match' })
  .refine((v) => v.newPassword === '' || v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

const EMPTY_PASSWORDS: PasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' };

function PasswordForm() {
  const changePassword = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: EMPTY_PASSWORDS });

  const onSubmit = async (v: PasswordValues) => {
    setServerError(null);
    setChanged(false);
    try {
      await changePassword.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      reset(EMPTY_PASSWORDS);
      setShow(false);
      setChanged(true);
    } catch (err) {
      setServerError(errorMessage(err, 'Could not change your password. Try again in a moment.'));
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <Panel
      title="Password"
      icon={glyphs.lock}
      action={
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-red-700"
          />
          Show passwords
        </label>
      }
    >
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        Changing it signs you out on every other phone or browser. You stay signed in here.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate onChange={() => setChanged(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
            <TextField
              label="Current password"
              type={type}
              autoComplete="current-password"
              registration={register('currentPassword')}
              error={errors.currentPassword?.message}
            />
          </div>
          <TextField
            label="New password"
            type={type}
            autoComplete="new-password"
            hint="At least 8 characters."
            registration={register('newPassword')}
            error={errors.newPassword?.message}
          />
          <TextField
            label="Confirm new password"
            type={type}
            autoComplete="new-password"
            registration={register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
        </div>

        <FormFooter
          status={
            serverError ? (
              <span className="text-red-600">{serverError}</span>
            ) : changed ? (
              <Saved>Password changed. Other devices were signed out.</Saved>
            ) : null
          }
        >
          <Button type="submit" disabled={isSubmitting} className="min-h-[40px] px-4">
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </FormFooter>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Preferences (notifications, reminders, privacy)
//
// These save on change rather than behind a Save button: each control is one
// independent choice, and the optimistic hook flips it immediately.

function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className={`block text-sm font-medium ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-red-700' : 'bg-slate-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

function usePreferenceSaver() {
  const update = useUpdateMyPreferences();
  const status = update.isPending ? (
    <span className="text-xs text-slate-500">Saving…</span>
  ) : update.isError ? (
    <span className="text-xs text-red-600">{errorMessage(update.error, 'Not saved. Try again.')}</span>
  ) : update.isSuccess ? (
    <span className="text-xs">
      <Saved>Saved</Saved>
    </span>
  ) : null;
  return { save: (patch: Partial<StudentPreferences>) => update.mutate(patch), status };
}

function NotificationsPanel({ prefs, profile }: { prefs: StudentPreferences; profile: StudentProfile }) {
  const { save, status } = usePreferenceSaver();
  const hasPhone = Boolean(profile.user.phone);

  return (
    <Panel title="Notifications" icon={icons.bell} action={<div aria-live="polite">{status}</div>}>
      <p className="-mt-2 mb-2 text-sm text-slate-500">Choose what shows up in your notifications.</p>
      <div className="divide-y divide-slate-100">
        <div className="flex items-start justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Enrollment &amp; account</p>
            <p className="mt-0.5 text-xs text-slate-500">Approvals, requirements, and anything that needs your action.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Always on</span>
        </div>
        <Switch
          label="Class schedule"
          description="Rescheduled or cancelled classes, room changes, and attendance."
          checked={prefs.notifySchedule}
          onChange={(v) => save({ notifySchedule: v })}
        />
        <Switch
          label="Exams & grades"
          description="New exams, results released, and graded attempts."
          checked={prefs.notifyExams}
          onChange={(v) => save({ notifyExams: v })}
        />
        <Switch
          label="Announcements"
          description="News and reminders posted by the center."
          checked={prefs.notifyAnnouncements}
          onChange={(v) => save({ notifyAnnouncements: v })}
        />
        <Switch
          label="Payments & billing"
          description="Verified payments, new invoices, and refunds."
          checked={prefs.notifyPayments}
          onChange={(v) => save({ notifyPayments: v })}
        />
        <Switch
          label="Certificates"
          description="When a certificate is issued to you."
          checked={prefs.notifyCertificates}
          onChange={(v) => save({ notifyCertificates: v })}
        />
      </div>

      <fieldset className="mt-3 border-t border-slate-100 pt-4">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Also send to</legend>
        <div className="divide-y divide-slate-100">
          <Switch
            label="Email"
            description={<span className="[overflow-wrap:anywhere]">{profile.user.email}</span>}
            checked={prefs.emailEnabled}
            onChange={(v) => save({ emailEnabled: v })}
          />
          <Switch
            label="Text message (SMS)"
            description={hasPhone ? profile.user.phone : 'Add a mobile number in Contact Details first.'}
            checked={prefs.smsEnabled && hasPhone}
            disabled={!hasPhone}
            onChange={(v) => save({ smsEnabled: v })}
          />
        </div>
      </fieldset>
    </Panel>
  );
}

const CLASS_REMINDER_OPTIONS = [
  { value: '', label: 'Off' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '180', label: '3 hours before' },
  { value: '1440', label: '1 day before' },
];

const DEFAULT_STUDY_TIME = '19:00';

function RemindersPanel({ prefs }: { prefs: StudentPreferences }) {
  const { save, status } = usePreferenceSaver();
  const classReminderId = useId();
  const studyTimeId = useId();
  const [studyTime, setStudyTime] = useState(prefs.studyReminderTime ?? DEFAULT_STUDY_TIME);
  const studyOn = prefs.studyReminderTime !== null;

  const commitStudyTime = () => {
    if (/^\d{2}:\d{2}$/.test(studyTime) && studyTime !== prefs.studyReminderTime) save({ studyReminderTime: studyTime });
  };

  return (
    <Panel title="Reminders" icon={icons.schedule} action={<div aria-live="polite">{status}</div>}>
      <p className="-mt-2 mb-2 text-sm text-slate-500">Nudges to keep you on track with classes and review.</p>
      <div className="divide-y divide-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="min-w-0">
            <label htmlFor={classReminderId} className="block text-sm font-medium text-slate-800">
              Before each class
            </label>
            <p className="mt-0.5 text-xs text-slate-500">A heads-up before your scheduled sessions.</p>
          </div>
          <div className="w-full sm:w-48">
            <Select
              id={classReminderId}
              value={prefs.classReminderMinutes?.toString() ?? ''}
              onChange={(e) => save({ classReminderMinutes: e.target.value === '' ? null : Number(e.target.value) })}
            >
              {CLASS_REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Switch
            label="Daily study reminder"
            description="A daily prompt to review materials or take a practice quiz."
            checked={studyOn}
            onChange={(v) => save({ studyReminderTime: v ? studyTime : null })}
          />
          {studyOn && (
            <div className="-mt-1 flex items-center gap-3 pb-3">
              <label htmlFor={studyTimeId} className="text-xs font-medium text-slate-600">
                Remind me at
              </label>
              <input
                id={studyTimeId}
                type="time"
                value={studyTime}
                onChange={(e) => setStudyTime(e.target.value)}
                onBlur={commitStudyTime}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-red-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        <Switch
          label="Weekly progress summary"
          description="Your attendance, quiz scores, and what’s coming up, every Monday."
          checked={prefs.weeklyDigest}
          onChange={(v) => save({ weeklyDigest: v })}
        />
      </div>
    </Panel>
  );
}

function PrivacyPanel({ prefs }: { prefs: StudentPreferences }) {
  const { save, status } = usePreferenceSaver();
  return (
    <Panel title="Privacy" icon={glyphs.shield} action={<div aria-live="polite">{status}</div>}>
      <p className="-mt-2 mb-2 text-sm text-slate-500">Both are off unless you turn them on. You can change your mind anytime.</p>
      <div className="divide-y divide-slate-100">
        <Switch
          label="Feature me in success stories"
          description="The center may share your name, program, and results (e.g. after passing the board exam) on its website and pages."
          checked={prefs.allowSuccessStory}
          onChange={(v) => save({ allowSuccessStory: v })}
        />
        <Switch
          label="Program news and promos"
          description="Hear about new programs, review sessions, and discounts."
          checked={prefs.marketingOptIn}
          onChange={(v) => save({ marketingOptIn: v })}
        />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Account summary (read-only)

function AccountPanel({ profile }: { profile: StudentProfile }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
    router.push('/login');
  };

  const rows = [
    { label: 'Name', value: `${profile.user.firstName} ${profile.user.lastName}` },
    { label: 'Email', value: profile.user.email },
    profile.dateOfBirth && { label: 'Date of birth', value: new Date(profile.dateOfBirth).toLocaleDateString('en-PH', { dateStyle: 'long' }) },
    { label: 'Student since', value: new Date(profile.createdAt).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Panel title="Account" icon={icons.profile}>
      <dl className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5 py-2.5 first:pt-0">
            <dt className="text-xs text-slate-500">{r.label}</dt>
            <dd className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
        Your name and email appear on your certificates, so only the registrar can change them.{' '}
        <Link href="/student/help" className="font-semibold text-red-700 underline underline-offset-2">
          Contact the center
        </Link>{' '}
        if something is wrong.
      </p>
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
        <Link
          href="/student/profile"
          className="flex min-h-[40px] items-center justify-between rounded-lg px-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
        >
          View profile &amp; enrollments
          <span className="text-slate-400">{icons.arrowRight}</span>
        </Link>
        <Button variant="secondary" className="min-h-[40px] w-full" onClick={handleLogout} disabled={signingOut}>
          <span className="inline-flex items-center justify-center gap-2">
            {icons.logout}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </span>
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function StudentSettingsPage() {
  const profile = useMyStudentProfile();
  const prefs = useMyPreferences();

  return (
    <StudentShell>
      <StudentPageHero
        badge={icons.settings}
        title="Settings"
        meta={<span>Your contact details, notifications, privacy, and password.</span>}
      />

      {profile.isLoading && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SkeletonRows count={2} className="h-64" />
          <SkeletonRows count={1} className="h-72" />
        </div>
      )}

      {profile.isError && <PanelMessage tone="error">Could not load your account. Refresh the page to try again.</PanelMessage>}

      {!profile.isLoading && !profile.isError && !profile.data && (
        <PanelMessage>No student profile is linked to this account yet. Contact the center for help.</PanelMessage>
      )}

      {profile.data && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="grid min-w-0 grid-cols-1 gap-5">
            <ContactForm profile={profile.data} />
            {prefs.isLoading && <SkeletonRows count={2} className="h-56" />}
            {prefs.isError && (
              <PanelMessage tone="error">Could not load your notification and privacy settings. Refresh to try again.</PanelMessage>
            )}
            {prefs.data && (
              <>
                <NotificationsPanel prefs={prefs.data} profile={profile.data} />
                <RemindersPanel prefs={prefs.data} />
                <PrivacyPanel prefs={prefs.data} />
              </>
            )}
            <PasswordForm />
          </div>
          <aside className="order-first min-w-0 xl:sticky xl:top-20 xl:order-none" aria-label="Account">
            <AccountPanel profile={profile.data} />
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
