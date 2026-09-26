'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { adminIcons } from '@/components/admin-shell';

interface Settings {
  id: string;
  organizationName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  additionalPhones: string[];
  address: string | null;
  facebookPageName: string | null;
  facebookUrl: string | null;
  timezone: string;
  enrollmentOpen: boolean;
  enrollmentNotice: string | null;
  allowSelfEnrollment: boolean;
  defaultCurrency: string;
  invoiceDueDays: number | null;
  receiptPrefix: string;
  certificatePrefix: string;
  notifyOnEnrollment: boolean;
  notifyOnPaymentVerified: boolean;
  notifyOnCertificateIssued: boolean;
  updatedAt: string;
}

const TIMEZONES = [
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Australia/Sydney',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

const CURRENCIES = [
  { code: 'PHP', label: 'PHP · Philippine peso' },
  { code: 'USD', label: 'USD · US dollar' },
  { code: 'SGD', label: 'SGD · Singapore dollar' },
  { code: 'AED', label: 'AED · UAE dirham' },
  { code: 'SAR', label: 'SAR · Saudi riyal' },
];

const prefix = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(10, 'Up to 10 characters')
  .regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only');

const settingsSchema = z.object({
  organizationName: z.string().trim().min(1, 'The center needs a name').max(120),
  timezone: z.string().min(1),
  supportEmail: z.union([z.literal(''), z.email('Enter a valid email address')]),
  supportPhone: z.string().trim().max(40),
  additionalPhones: z.array(z.object({ value: z.string().trim().max(40) })).max(6),
  address: z.string().trim().max(300),
  facebookPageName: z.string().trim().max(120),
  facebookUrl: z.union([z.literal(''), z.url('Include https://, e.g. https://facebook.com/yourpage')]),
  enrollmentOpen: z.boolean(),
  enrollmentNotice: z.string().trim().max(80, 'Keep it under 80 characters'),
  allowSelfEnrollment: z.boolean(),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  invoiceDueDays: z
    .string()
    .trim()
    .regex(/^\d*$/, 'Whole days only')
    .refine((v) => v === '' || Number(v) <= 365, 'Up to 365 days'),
  receiptPrefix: prefix,
  certificatePrefix: prefix,
  notifyOnEnrollment: z.boolean(),
  notifyOnPaymentVerified: z.boolean(),
  notifyOnCertificateIssued: z.boolean(),
});
type SettingsValues = z.infer<typeof settingsSchema>;

function toFormValues(s: Settings): SettingsValues {
  return {
    organizationName: s.organizationName,
    timezone: s.timezone,
    supportEmail: s.supportEmail ?? '',
    supportPhone: s.supportPhone ?? '',
    additionalPhones: (s.additionalPhones ?? []).map((value) => ({ value })),
    address: s.address ?? '',
    facebookPageName: s.facebookPageName ?? '',
    facebookUrl: s.facebookUrl ?? '',
    enrollmentOpen: s.enrollmentOpen,
    enrollmentNotice: s.enrollmentNotice ?? '',
    allowSelfEnrollment: s.allowSelfEnrollment,
    defaultCurrency: s.defaultCurrency,
    invoiceDueDays: s.invoiceDueDays == null ? '' : String(s.invoiceDueDays),
    receiptPrefix: s.receiptPrefix,
    certificatePrefix: s.certificatePrefix,
    notifyOnEnrollment: s.notifyOnEnrollment,
    notifyOnPaymentVerified: s.notifyOnPaymentVerified,
    notifyOnCertificateIssued: s.notifyOnCertificateIssued,
  };
}

// Blank text clears a nullable setting (null), never leaves it untouched.
function toPayload(v: SettingsValues) {
  const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    organizationName: v.organizationName.trim(),
    timezone: v.timezone,
    supportEmail: orNull(v.supportEmail),
    supportPhone: orNull(v.supportPhone),
    additionalPhones: v.additionalPhones.map((p) => p.value.trim()).filter(Boolean),
    address: orNull(v.address),
    facebookPageName: orNull(v.facebookPageName),
    facebookUrl: orNull(v.facebookUrl),
    enrollmentOpen: v.enrollmentOpen,
    enrollmentNotice: orNull(v.enrollmentNotice),
    allowSelfEnrollment: v.allowSelfEnrollment,
    defaultCurrency: v.defaultCurrency,
    invoiceDueDays: v.invoiceDueDays === '' ? null : Number(v.invoiceDueDays),
    receiptPrefix: v.receiptPrefix.trim(),
    certificatePrefix: v.certificatePrefix.trim(),
    notifyOnEnrollment: v.notifyOnEnrollment,
    notifyOnPaymentVerified: v.notifyOnPaymentVerified,
    notifyOnCertificateIssued: v.notifyOnCertificateIssued,
  };
}

// ---------------------------------------------------------------------------
// Pieces

const SECTIONS = [
  { id: 'organization', title: 'Organization', icon: adminIcons.grid },
  { id: 'contact', title: 'Contact & website', icon: adminIcons.mapPin },
  { id: 'enrollment', title: 'Enrollment', icon: adminIcons.userPlus },
  { id: 'finance', title: 'Finance & documents', icon: adminIcons.creditCard },
  { id: 'notifications', title: 'Notifications', icon: adminIcons.bell },
] as const;

function Section({
  id,
  description,
  children,
}: {
  id: (typeof SECTIONS)[number]['id'];
  description: string;
  children: React.ReactNode;
}) {
  const meta = SECTIONS.find((s) => s.id === id)!;
  return (
    <Card className="overflow-hidden">
      <section id={`settings-${id}`} aria-labelledby={`settings-${id}-title`} className="scroll-mt-6">
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {meta.icon}
          </span>
          <div>
            <h2 id={`settings-${id}-title`} className="text-sm font-semibold text-slate-900">
              {meta.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
        </header>
        <div className="space-y-5 px-5 py-5">{children}</div>
      </section>
    </Card>
  );
}

function Toggle({
  control,
  name,
  label,
  description,
  disabled,
}: {
  control: Control<SettingsValues>;
  name: 'enrollmentOpen' | 'allowSelfEnrollment' | 'notifyOnEnrollment' | 'notifyOnPaymentVerified' | 'notifyOnCertificateIssued';
  label: string;
  description: React.ReactNode;
  disabled?: boolean;
}) {
  const id = `toggle-${name}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-60' : ''}`}>
          <div className="min-w-0">
            <label htmlFor={id} className="text-sm font-medium text-slate-900">
              {label}
            </label>
            <p id={`${id}-desc`} className="mt-0.5 text-xs text-slate-500">
              {description}
            </p>
          </div>
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={field.value}
            aria-describedby={`${id}-desc`}
            disabled={disabled}
            onClick={() => field.onChange(!field.value)}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed ${
              field.value ? 'bg-red-700' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                field.value ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      )}
    />
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="-mt-3 text-xs text-slate-500">{children}</p>;
}

// ---------------------------------------------------------------------------
// Page

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const canManage = hasPermission('settings.manage');

  const settingsQuery = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => (await apiClient.get('/v1/settings')).data,
  });

  const formValues = useMemo(() => (settingsQuery.data ? toFormValues(settingsQuery.data) : undefined), [settingsQuery.data]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    values: formValues,
    resetOptions: { keepDirtyValues: false },
  });
  const phones = useFieldArray({ control, name: 'additionalPhones' });

  const watched = useWatch({ control });
  const enrollmentOpen = watched.enrollmentOpen ?? true;

  const onSubmit = async (values: SettingsValues) => {
    setServerError(null);
    try {
      const { data } = await apiClient.patch<Settings>('/v1/settings', toPayload(values));
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['public', 'settings'] });
      reset(toFormValues(data));
      setSavedAt(new Date());
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save settings. Check the highlighted fields and try again.'));
    }
  };

  // Keep a saved value that isn't in the curated list selectable, without
  // ever listing the same option twice.
  const savedTimezone = settingsQuery.data?.timezone;
  const timezoneOptions = savedTimezone && !TIMEZONES.includes(savedTimezone) ? [savedTimezone, ...TIMEZONES] : TIMEZONES;
  const savedCurrency = settingsQuery.data?.defaultCurrency;
  const currencyOptions =
    savedCurrency && !CURRENCIES.some((c) => c.code === savedCurrency)
      ? [{ code: savedCurrency, label: savedCurrency }, ...CURRENCIES]
      : CURRENCIES;

  const year = new Date().getFullYear();
  const receiptPreview = `${watched.receiptPrefix?.toUpperCase() || 'RCPT'}-3F9A2C1B`;
  const certificatePreview = `${watched.certificatePrefix?.toUpperCase() || 'CERT'}-${year}-8E41D07A`;
  const lastUpdated = settingsQuery.data?.updatedAt
    ? new Date(settingsQuery.data.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="How the center presents itself, takes enrollments, bills and keeps people informed."
      />

      {settingsQuery.isLoading && (
        <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="hidden h-48 animate-pulse rounded-xl bg-slate-100 lg:block" />
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      )}
      {settingsQuery.isError && <ErrorState message="Couldn't load settings. Refresh the page to try again." />}

      {settingsQuery.data && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <nav aria-label="Settings sections" className="hidden lg:block">
              <ul className="sticky top-6 space-y-1">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#settings-${s.id}`}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-red-600 [&_svg]:h-4 [&_svg]:w-4"
                    >
                      <span className="text-slate-400">{s.icon}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
                {lastUpdated && <li className="px-3 pt-4 text-xs text-slate-400">Last saved {lastUpdated}</li>}
              </ul>
            </nav>

            <div className="min-w-0 max-w-3xl space-y-6 pb-24">
              {!canManage && (
                <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 [&_svg]:h-4 [&_svg]:w-4">
                  {adminIcons.shield}
                  You can view these settings. Changing them needs the settings.manage permission.
                </p>
              )}

              <fieldset disabled={!canManage} className="space-y-6">
                <Section id="organization" description="The name shown across the admin portal and public website.">
                  <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
                    <Field label="Center name" error={errors.organizationName?.message}>
                      <Input {...register('organizationName')} />
                    </Field>
                    <Field label="Time zone">
                      <Select {...register('timezone')}>
                        {timezoneOptions.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </Section>

                <Section
                  id="contact"
                  description="Shown in the public website's footer and contact page. Blank fields fall back to the center's published details."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Support email" error={errors.supportEmail?.message}>
                      <Input type="email" {...register('supportEmail')} placeholder="hello@example.com" />
                    </Field>
                    <Field label="Main phone" error={errors.supportPhone?.message}>
                      <Input type="tel" {...register('supportPhone')} placeholder="0917 000 0000" />
                    </Field>
                  </div>

                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-700">Other phone numbers</p>
                    <div className="space-y-2">
                      {phones.fields.map((f, i) => (
                        <div key={f.id} className="flex items-center gap-2">
                          <div className="flex-1">
                            <Input type="tel" aria-label={`Other phone ${i + 1}`} {...register(`additionalPhones.${i}.value`)} />
                          </div>
                          <button
                            type="button"
                            onClick={() => phones.remove(i)}
                            aria-label={`Remove phone ${i + 1}`}
                            className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                              <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    {phones.fields.length < 6 && (
                      <button
                        type="button"
                        onClick={() => phones.append({ value: '' })}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                        </svg>
                        Add phone number
                      </button>
                    )}
                  </div>

                  <Field label="Address" error={errors.address?.message}>
                    <Textarea rows={2} {...register('address')} placeholder="Building, street, barangay, city" />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Facebook page name" error={errors.facebookPageName?.message}>
                      <Input {...register('facebookPageName')} />
                    </Field>
                    <Field label="Facebook page link" error={errors.facebookUrl?.message}>
                      <Input type="url" {...register('facebookUrl')} placeholder="https://facebook.com/…" />
                    </Field>
                  </div>
                </Section>

                <Section id="enrollment" description="Controls the public enrollment banner and whether reviewees can sign up online.">
                  <Toggle
                    control={control}
                    name="enrollmentOpen"
                    label="Enrollment is open"
                    description="When closed, the website says so and online sign-up is blocked. Inquiries still come through."
                  />
                  <div className={enrollmentOpen ? '' : 'opacity-60'}>
                    <Field label="Website banner" error={errors.enrollmentNotice?.message}>
                      <Input {...register('enrollmentNotice')} disabled={!canManage || !enrollmentOpen} placeholder="Now Accepting Enrollees!" />
                    </Field>
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#8b1a2b] px-3 py-2.5" aria-label="Banner preview">
                      <span className="rounded bg-[#f5c518] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#6b141f]">
                        {enrollmentOpen
                          ? watched.enrollmentNotice?.trim() || 'No banner text'
                          : 'Enrollment closed · Inquire for the next intake'}
                      </span>
                      <span className="text-xs text-white/70">Preview of the home page banner</span>
                    </div>
                  </div>
                  <Toggle
                    control={control}
                    name="allowSelfEnrollment"
                    label="Allow online self-registration"
                    description="Reviewees can create their own student account from the website. Off means registrars create every account."
                    disabled={!canManage || !enrollmentOpen}
                  />
                </Section>

                <Section id="finance" description="Defaults for new prices and invoices, and how receipt and certificate numbers begin.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default currency">
                      <Select {...register('defaultCurrency')}>
                        {currencyOptions.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Invoice due in (days)" error={errors.invoiceDueDays?.message}>
                      <Input inputMode="numeric" {...register('invoiceDueDays')} placeholder="No default" />
                    </Field>
                  </div>
                  <Hint>
                    Currency applies to new program prices. The due-date default is used when an invoice is created without one; leave it
                    blank for no due date.
                  </Hint>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Field label="Receipt number prefix" error={errors.receiptPrefix?.message}>
                        <Input
                          {...register('receiptPrefix', { setValueAs: (v: string) => v.toUpperCase() })}
                          maxLength={10}
                        />
                      </Field>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Next receipts look like <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{receiptPreview}</code>
                      </p>
                    </div>
                    <div>
                      <Field label="Certificate number prefix" error={errors.certificatePrefix?.message}>
                        <Input
                          {...register('certificatePrefix', { setValueAs: (v: string) => v.toUpperCase() })}
                          maxLength={10}
                        />
                      </Field>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Next certificates look like{' '}
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{certificatePreview}</code>
                      </p>
                    </div>
                  </div>
                  <Hint>Changing a prefix only affects documents issued from now on; existing numbers stay as they are.</Hint>
                </Section>

                <Section id="notifications" description="In-app notifications sent to students when something happens on their account.">
                  <Toggle
                    control={control}
                    name="notifyOnEnrollment"
                    label="Enrollment approved or confirmed"
                    description="Tells the student when their application is approved and when they're fully enrolled."
                  />
                  <div className="border-t border-slate-100" />
                  <Toggle
                    control={control}
                    name="notifyOnPaymentVerified"
                    label="Payment verified"
                    description="Sends the amount and receipt number once a cashier verifies a payment."
                  />
                  <div className="border-t border-slate-100" />
                  <Toggle
                    control={control}
                    name="notifyOnCertificateIssued"
                    label="Certificate issued"
                    description="Lets the student know their completion certificate is ready."
                  />
                </Section>
              </fieldset>
            </div>
          </div>

          {canManage && (isDirty || serverError || savedAt) && (
            <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_-6px_rgb(15_23_42/0.12)] md:-mx-6 md:px-6">
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="mr-auto text-sm" role="status">
                  {serverError ? (
                    <span className="text-red-700">{serverError}</span>
                  ) : isDirty ? (
                    <span className="text-slate-600">You have unsaved changes.</span>
                  ) : savedAt ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Settings saved. The website updates within a minute.
                    </span>
                  ) : null}
                </p>
                {isDirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (formValues) reset(formValues);
                      setServerError(null);
                    }}
                  >
                    Discard
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting || !isDirty}>
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
