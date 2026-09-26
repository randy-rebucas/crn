'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from '@/components/ui';

interface Lead {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  programInterest: string | null;
  source: string | null;
  message?: string | null;
  status: LeadStatus;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt?: string;
}

interface FollowUp {
  id: string;
  note: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Program {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  user: { id: string; firstName: string; lastName: string };
}

type LeadStatus = 'LEAD' | 'INQUIRY' | 'APPLICATION' | 'APPLICANT' | 'ENROLLED' | 'LOST';

const STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'LEAD', label: 'New', color: '#cbd5e1' },
  { status: 'INQUIRY', label: 'Inquiry', color: '#93c5fd' },
  { status: 'APPLICATION', label: 'Application', color: '#2563eb' },
  { status: 'APPLICANT', label: 'Applicant', color: '#f59e0b' },
  { status: 'ENROLLED', label: 'Enrolled', color: '#059669' },
  { status: 'LOST', label: 'Lost', color: '#94a3b8' },
];

// Mirrors LEAD_TRANSITIONS in apps/api/src/modules/leads/lead-transitions.ts
// (the API re-validates every move), named for what the move means.
const FORWARD: Partial<Record<LeadStatus, { to: LeadStatus; label: string }>> = {
  LEAD: { to: 'INQUIRY', label: 'Mark as inquiry' },
  INQUIRY: { to: 'APPLICATION', label: 'Mark as application' },
  APPLICATION: { to: 'APPLICANT', label: 'Mark as applicant' },
  APPLICANT: { to: 'ENROLLED', label: 'Mark as enrolled' },
};
const OPEN: LeadStatus[] = ['LEAD', 'INQUIRY', 'APPLICATION', 'APPLICANT'];

const LEAD_SOURCES = ['Walk-in', 'Phone inquiry', 'Website', 'Facebook', 'Referral', 'School fair', 'Advertisement', 'Other'] as const;

// Loose but useful: accepts common PH formats like 09171234567 or +63 917 123 4567.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

const icons = {
  funnel: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 5h16l-6 7.5v5.5l-4 2v-7.5L4 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.8 2.8M15.2 15.2 18 18M18 6l-2.8 2.8M8.8 15.2 6 18" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m4 16 5-5 4 4 7-7M15 8h5v5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  userQ: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={9.5} cy={8.5} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 20c.9-3.4 3.6-5.3 6-5.3 1 0 2 .3 2.9.8M17.5 13.5a2 2 0 1 1 2.3 2c-.5.1-.8.5-.8 1v.3M19 20h.01" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  megaphone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M17.5 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <circle cx={4.8} cy={6.5} r={1} fill="currentColor" />
      <circle cx={4.8} cy={12} r={1} fill="currentColor" />
      <circle cx={4.8} cy={17.5} r={1} fill="currentColor" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3A2 2 0 0 1 18 20.5 15.5 15.5 0 0 1 3.5 6 2 2 0 0 1 5.5 4Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx={12} cy={8} r={3.3} stroke="currentColor" strokeWidth={1.8} />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h0a2 2 0 0 1-2-2V6.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={11} cy={11} r={6.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
};

function SectionCard({
  icon,
  title,
  meta,
  action,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-700">{icon}</span>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {meta && <span className="text-xs text-slate-400">{meta}</span>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

// --- Create form ------------------------------------------------------------

const createLeadSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Add their name'),
    email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]).optional(),
    phone: z.union([z.literal(''), z.string().regex(PHONE_REGEX, 'Enter a valid phone number')]).optional(),
    programInterest: z.string().optional(),
    source: z.string().optional(),
    message: z.string().optional(),
    assignedToId: z.string().optional(),
  })
  .refine((v) => Boolean(v.email || v.phone), { path: ['phone'], message: 'Add a phone number or email so someone can follow up' });
type CreateLeadValues = z.infer<typeof createLeadSchema>;

function CreateLeadForm({ onCreated }: { onCreated: () => void }) {
  const { user, hasPermission } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  // Only feeds the suggestions list, so it's skipped without programs.view.
  const { data: programs } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
    enabled: hasPermission('programs.view'),
  });
  const { data: staff } = useQuery<StaffOption[]>({
    queryKey: ['staff'],
    queryFn: async () => (await apiClient.get('/v1/staff')).data,
    enabled: hasPermission('staff.view'),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLeadValues>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { fullName: '', email: '', phone: '', programInterest: '', source: '', message: '', assignedToId: user?.id ?? '' },
  });

  const others = (staff ?? []).filter((s) => s.user.id !== user?.id);

  const onSubmit = async (values: CreateLeadValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/leads', {
        fullName: values.fullName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        programInterest: values.programInterest || undefined,
        source: values.source || undefined,
        message: values.message?.trim() || undefined,
        assignedToId: values.assignedToId || undefined,
        branchId: user?.branchIds.length === 1 ? user.branchIds[0] : undefined,
      });
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save the lead. Check your connection and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Who they are</legend>
        <Field label="Full name" error={errors.fullName?.message}>
          <Input autoComplete="off" {...register('fullName')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" error={errors.phone?.message}>
            <Input type="tel" placeholder="09XX XXX XXXX" {...register('phone')} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="off" {...register('email')} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-slate-100 pt-5">
        <legend className="sr-only">What they want</legend>
        <p className="-mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">What they want</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Program interest">
            <Input list="program-interest-options" placeholder="Start typing a program…" {...register('programInterest')} />
            <datalist id="program-interest-options">
              {(programs ?? []).map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </Field>
          <Field label="How they found us">
            <Select {...register('source')}>
              <option value="">Not recorded</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="What they asked about">
          <Textarea rows={3} placeholder="Optional — schedule, fees, requirements…" {...register('message')} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-slate-100 pt-5">
        <legend className="sr-only">Follow-up</legend>
        <Field label="Who follows up">
          <Select {...register('assignedToId')}>
            <option value="">No one yet</option>
            {user && <option value={user.id}>Me ({user.email})</option>}
            {others.map((s) => (
              <option key={s.id} value={s.user.id}>
                {s.user.firstName} {s.user.lastName}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save lead'}
        </Button>
      </div>
    </form>
  );
}

// --- Row detail: message + follow-ups ---------------------------------------

function LeadDetail({ lead, canUpdate }: { lead: Lead; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery<Lead & { followUps: FollowUp[] }>({
    queryKey: ['leads', lead.id],
    queryFn: async () => (await apiClient.get(`/v1/leads/${lead.id}`)).data,
  });

  const add = useMutation({
    mutationFn: () => apiClient.post(`/v1/leads/${lead.id}/follow-ups`, { note: note.trim(), dueDate: dueDate || undefined }),
    onSuccess: () => {
      setNote('');
      setDueDate('');
      setError(null);
      return queryClient.invalidateQueries({ queryKey: ['leads', lead.id] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not add the follow-up. Try again.')),
  });

  const today = todayKey();
  const followUps = [...(detail.data?.followUps ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const message = detail.data?.message ?? lead.message;

  return (
    <div className="grid gap-5 rounded-lg bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-500">What they asked about</p>
        {message ? (
          <p className="flex gap-2 text-sm text-slate-700">
            <span className="mt-0.5 text-slate-400">{icons.chat}</span>
            <span>{message}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-400">No message recorded.</p>
        )}
        <dl className="mt-3 space-y-1 text-xs text-slate-500">
          <div>
            Added <span className="text-slate-700">{shortDate(lead.createdAt)}</span>
          </div>
          {lead.updatedAt && lead.updatedAt !== lead.createdAt && (
            <div>
              Last change <span className="text-slate-700">{shortDate(lead.updatedAt)}</span>
            </div>
          )}
        </dl>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-500">Follow-ups</p>
        {detail.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : detail.isError ? (
          <p className="text-sm text-red-700">Could not load follow-ups.</p>
        ) : followUps.length === 0 ? (
          <p className="text-sm text-slate-400">No follow-ups yet.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {followUps.map((f) => {
              const due = f.dueDate?.slice(0, 10);
              const overdue = !f.completedAt && due && due < today;
              return (
                <li key={f.id} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-50 ${
                      f.completedAt ? 'bg-emerald-600' : overdue ? 'bg-red-600' : 'bg-slate-400'
                    }`}
                    aria-hidden
                  />
                  <p className="text-sm text-slate-800">{f.note}</p>
                  <p className="text-xs text-slate-500">
                    {shortDate(f.createdAt)}
                    {due && (
                      <span className={overdue ? 'font-medium text-red-700' : ''}>
                        {' · '}
                        {f.completedAt ? 'done' : overdue ? `overdue since ${shortDate(f.dueDate!)}` : `due ${shortDate(f.dueDate!)}`}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {canUpdate && (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim()) add.mutate();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Follow-up note</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Call back about the May batch schedule"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
              />
            </label>
            <label className="sm:w-40">
              <span className="sr-only">Due date</span>
              <input
                type="date"
                value={dueDate}
                min={today}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={add.isPending || !note.trim()}>
              {add.isPending ? 'Adding…' : 'Add'}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Row status actions -----------------------------------------------------

function LeadActions({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [confirmLost, setConfirmLost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: (status: LeadStatus) => apiClient.patch(`/v1/leads/${lead.id}/status`, { status }),
    onSuccess: () => {
      setError(null);
      setConfirmLost(false);
      return queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not update this lead. Try again.')),
  });

  const forward = FORWARD[lead.status];
  if (!OPEN.includes(lead.status)) return <span className="block text-xs text-slate-400 lg:text-right">Closed</span>;
  const small = '!px-2.5 !py-1 text-xs';
  const pending = move.isPending ? move.variables : null;

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      {confirmLost ? (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <span className="text-xs text-slate-600">Close this lead as lost?</span>
          <Button variant="danger" className={small} disabled={move.isPending} onClick={() => move.mutate('LOST')}>
            {pending === 'LOST' ? 'Saving…' : 'Mark as lost'}
          </Button>
          <Button variant="ghost" className={small} disabled={move.isPending} onClick={() => setConfirmLost(false)}>
            Keep open
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {lead.status === 'APPLICATION' ? (
            <>
              <Link
                href="/admissions"
                className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-800"
              >
                Start admission review
              </Link>
              <Button variant="secondary" className={small} disabled={move.isPending} onClick={() => move.mutate('APPLICANT')}>
                {pending === 'APPLICANT' ? 'Saving…' : 'Mark applicant'}
              </Button>
            </>
          ) : (
            forward && (
              <Button className={small} disabled={move.isPending} onClick={() => move.mutate(forward.to)}>
                {pending === forward.to ? 'Saving…' : forward.label}
              </Button>
            )
          )}
          <Button
            variant="ghost"
            className={`${small} !text-slate-500 hover:!bg-slate-100`}
            disabled={move.isPending}
            onClick={() => setConfirmLost(true)}
          >
            Lost
          </Button>
        </div>
      )}
      {lead.status === 'APPLICATION' && !confirmLost && (
        <p className="text-[11px] text-slate-400">Approving an admission moves them to Applicant.</p>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-xs text-red-700 lg:text-right">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function LeadsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [stageFilter, setStageFilter] = useState<'ALL' | 'OPEN' | 'UNASSIGNED' | LeadStatus>('OPEN');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canUpdate = hasPermission('leads.update');

  // One unfiltered fetch: stage filtering, counts, and both charts all read it.
  const { data, isLoading, isError } = useQuery<Lead[]>({
    queryKey: ['leads', 'list', ''],
    queryFn: async () => (await apiClient.get('/v1/leads')).data,
  });
  const leads = data ?? [];

  const open = leads.filter((l) => OPEN.includes(l.status));
  const newThisWeek = leads.filter((l) => daysSince(l.createdAt) < 7).length;
  const enrolled = leads.filter((l) => l.status === 'ENROLLED').length;
  const lost = leads.filter((l) => l.status === 'LOST').length;
  const conversion = enrolled + lost ? Math.round((enrolled / (enrolled + lost)) * 100) : null;
  const unassignedOpen = open.filter((l) => !l.assignedTo).length;

  const pipeline = STAGES.map((s) => ({
    ...s,
    count: leads.filter((l) => l.status === s.status).length,
    // Per-bar colour; the selected stage stays solid, the rest fade.
    fill: ['ALL', 'OPEN', 'UNASSIGNED'].includes(stageFilter) || stageFilter === s.status ? s.color : `${s.color}59`,
  }));

  const sources = [...new Set(leads.map((l) => l.source ?? 'Not recorded'))];
  const bySource = sources
    .map((src) => {
      const list = leads.filter((l) => (l.source ?? 'Not recorded') === src);
      return {
        source: src,
        open: list.filter((l) => OPEN.includes(l.status)).length,
        enrolled: list.filter((l) => l.status === 'ENROLLED').length,
        lost: list.filter((l) => l.status === 'LOST').length,
        total: list.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const q = search.trim().toLowerCase();
  const visible = leads.filter((l) => {
    if (stageFilter === 'OPEN' && !OPEN.includes(l.status)) return false;
    if (stageFilter === 'UNASSIGNED' && (l.assignedTo || !OPEN.includes(l.status))) return false;
    if (!['ALL', 'OPEN', 'UNASSIGNED'].includes(stageFilter) && l.status !== stageFilter) return false;
    if (sourceFilter !== 'ALL' && (l.source ?? 'Not recorded') !== sourceFilter) return false;
    if (!q) return true;
    return `${l.fullName} ${l.email ?? ''} ${l.phone ?? ''} ${l.programInterest ?? ''} ${l.source ?? ''}`.toLowerCase().includes(q);
  });

  const chips = [
    { key: 'OPEN' as const, label: 'Open', count: open.length, color: undefined as string | undefined },
    { key: 'ALL' as const, label: 'All', count: leads.length, color: undefined },
    ...(unassignedOpen ? [{ key: 'UNASSIGNED' as const, label: 'Unassigned', count: unassignedOpen, color: '#d97706' }] : []),
    ...pipeline.filter((p) => p.count > 0).map((p) => ({ key: p.status, label: p.label, count: p.count, color: p.color })),
  ];

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Inquiries moving through the admissions pipeline: Lead → Inquiry → Application → Applicant → Enrolled."
        action={
          hasPermission('leads.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New lead
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New lead">
        {showForm && (
          <CreateLeadForm
            onCreated={() => {
              setShowForm(false);
              setStageFilter('OPEN');
              queryClient.invalidateQueries({ queryKey: ['leads'] });
            }}
          />
        )}
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load leads. Refresh the page to try again." />}
      {!isLoading && !isError && leads.length === 0 && (
        <EmptyState title="No leads yet" description="Add walk-ins, calls, and messages here so nobody falls through the cracks." />
      )}

      {leads.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
            {[
              { icon: icons.funnel, label: 'Open leads', value: open.length, warn: false },
              { icon: icons.spark, label: 'New in the last 7 days', value: newThisWeek, warn: false },
              { icon: icons.trend, label: 'Of closed leads, enrolled', value: conversion === null ? '—' : `${conversion}%`, warn: false },
              { icon: icons.userQ, label: 'Open with no one assigned', value: unassignedOpen, warn: unassignedOpen > 0 },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-4 sm:p-5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    stat.warn ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stat.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{stat.value}</div>
                  <div className="text-xs leading-snug text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </Card>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <SectionCard icon={icons.funnel} title="Pipeline" meta="Select a stage to filter">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={pipeline} layout="vertical" barCategoryGap="24%" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" interval={0} width={84} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} formatter={(v) => [v, 'Leads']} />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const status = pipeline[index].status;
                      setStageFilter(stageFilter === status ? 'OPEN' : status);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard icon={icons.megaphone} title="Leads by source" meta="Where they came from, and how they turned out">
              <ResponsiveContainer width="100%" height={Math.max(170, bySource.length * 34 + 30)}>
                <BarChart data={bySource} layout="vertical" barCategoryGap="28%" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="source" interval={0} width={96} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                    formatter={(v, k) => [v, k === 'open' ? 'Still open' : k === 'enrolled' ? 'Enrolled' : 'Lost']}
                  />
                  <Bar dataKey="enrolled" stackId="s" fill="#059669" isAnimationActive={false} />
                  <Bar dataKey="open" stackId="s" fill="#2563eb" isAnimationActive={false} />
                  <Bar dataKey="lost" stackId="s" fill="#cbd5e1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {[
                  ['#059669', 'Enrolled'],
                  ['#2563eb', 'Still open'],
                  ['#cbd5e1', 'Lost'],
                ].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            icon={icons.list}
            title="Leads"
            meta={`${visible.length} shown`}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {sources.length > 1 && (
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    aria-label="Filter by source"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
                  >
                    <option value="ALL">All sources</option>
                    {sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                <label className="relative block w-full sm:w-60">
                  <span className="sr-only">Search leads</span>
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, contact, program"
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                  />
                </label>
              </div>
            }
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter leads">
              {chips.map((chip) => {
                const on = stageFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStageFilter(chip.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chip.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />}
                    {chip.label}
                    <span className={`tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{chip.count}</span>
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No leads match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStageFilter('ALL');
                      setSourceFilter('ALL');
                    }}
                    className="font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    show every lead
                  </button>
                  .
                </p>
              </div>
            ) : (
              <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100">
                {visible.map((lead) => {
                  const expanded = expandedId === lead.id;
                  const age = daysSince(lead.updatedAt ?? lead.createdAt);
                  const stale = OPEN.includes(lead.status) && age >= 14;
                  return (
                    <li key={lead.id} className="px-5 py-4">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_19rem] lg:items-start">
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : lead.id)}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${lead.fullName}`}
                            className={`mt-2 text-slate-400 transition-transform hover:text-slate-700 ${expanded ? 'rotate-90' : ''}`}
                          >
                            {icons.chevron}
                          </button>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {initials(lead.fullName)}
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : lead.id)}
                              className="block max-w-full truncate text-left font-medium text-slate-900 hover:text-red-700"
                            >
                              {lead.fullName}
                            </button>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                              {lead.phone && (
                                <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 hover:text-red-700">
                                  {icons.phone}
                                  {lead.phone}
                                </a>
                              )}
                              {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex min-w-0 items-center gap-1 hover:text-red-700">
                                  {icons.mail}
                                  <span className="truncate">{lead.email}</span>
                                </a>
                              )}
                              {!lead.phone && !lead.email && <span className="text-amber-700">No contact details</span>}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0 pl-[4.25rem] lg:pl-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={lead.status} />
                            <span className="truncate text-sm text-slate-800">{lead.programInterest ?? 'Interest not recorded'}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            <span>{lead.source ?? 'Source not recorded'}</span>
                            <span className={`flex items-center gap-1 ${lead.assignedTo ? '' : OPEN.includes(lead.status) ? 'text-amber-700' : ''}`}>
                              {icons.person}
                              {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned'}
                            </span>
                            <span className={stale ? 'font-medium text-amber-700' : ''} title={`Last change ${shortDate(lead.updatedAt ?? lead.createdAt)}`}>
                              {age === 0 ? 'Updated today' : `${age}d since last change`}
                            </span>
                          </div>
                        </div>

                        <div className="pl-[4.25rem] lg:pl-0">{canUpdate ? <LeadActions lead={lead} /> : null}</div>
                      </div>

                      {expanded && (
                        <div className="mt-3 lg:pl-[4.25rem]">
                          <LeadDetail lead={lead} canUpdate={canUpdate} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
