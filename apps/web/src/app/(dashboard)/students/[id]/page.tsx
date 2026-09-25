'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, ErrorState, LoadingState, StatusBadge } from '@/components/ui';

interface Enrollment {
  id: string;
  status: string;
  programId: string;
  batchId: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface StudentDetail {
  id: string;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  educationBackground: string | null;
  dateOfBirth: string | null;
  branchId: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; status: string };
  enrollments: Enrollment[];
}

interface Program {
  id: string;
  name: string;
}
interface Batch {
  id: string;
  name: string;
  startDate: string;
}
interface Branch {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  class: { id: string; name: string; course?: { name: string; code: string } | null };
}

interface Invoice {
  id: string;
  enrollmentId: string;
  totalAmount: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  payments: { id: string; amount: number; status: string; refunds?: { amount: number }[] }[];
  enrollment?: { program?: { name: string } | null } | null;
}

interface Certificate {
  id: string;
  studentId: string;
  certificateNumber: string;
  issuedAt: string;
  program?: { name: string } | null;
}

const ATTENDANCE_META: Record<AttendanceRecord['status'], { label: string; color: string }> = {
  PRESENT: { label: 'Present', color: '#059669' },
  LATE: { label: 'Late', color: '#f59e0b' },
  ABSENT: { label: 'Absent', color: '#b91c1c' },
  EXCUSED: { label: 'Excused', color: '#3b82f6' },
};

// The enrollment workflow's eleven statuses, folded into the five steps a
// registrar actually talks about. Cancelled/rejected stop the track.
const STEPS = ['Applied', 'Approved', 'Payment', 'Enrolled', 'Completed'] as const;
function stepIndex(status: string) {
  switch (status) {
    case 'DRAFT':
      return -1;
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'REQUIREMENTS_INCOMPLETE':
      return 0;
    case 'APPROVED':
      return 1;
    case 'PAYMENT_PENDING':
    case 'PAYMENT_VERIFIED':
      return 2;
    case 'ENROLLED':
      return 3;
    case 'COMPLETED':
      return 4;
    default:
      return null;
  }
}

function pesos(centavos: number) {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ageFrom(iso: string) {
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

function netPaid(inv: Invoice) {
  return inv.payments
    .filter((p) => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + p.amount - (p.refunds ?? []).reduce((r, x) => r + x.amount, 0), 0);
}

const icons = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m14.5 6-6 6 6 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3A2 2 0 0 1 18 20.5 15.5 15.5 0 0 1 3.5 6 2 2 0 0 1 5.5 4Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x={4} y={5.5} width={16} height={15} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  grad: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M7 3.5h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2v-16a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="m9 11 2 2 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 9.5h17M7 14.5h4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={9} r={5.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8.5 13.3-1.5 7.2 5-2.5 5 2.5-1.5-7.2" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={8} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  lifebuoy: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={12} r={8.2} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={3.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m6.2 6.2 3.3 3.3m5 5 3.3 3.3m0-11.6-3.3 3.3m-5 5-3.3 3.3" stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
};

function SectionCard({
  icon,
  title,
  meta,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-700">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {meta && <span className="text-xs text-slate-400">{meta}</span>}
      </div>
      {children}
    </Card>
  );
}

function StepTrack({ status }: { status: string }) {
  const idx = stepIndex(status);
  if (idx === null) {
    return (
      <p className="text-xs text-slate-500">
        This enrollment was {status === 'REJECTED' ? 'rejected' : 'cancelled'} and is no longer moving forward.
      </p>
    );
  }
  return (
    <ol className="flex items-center gap-1" aria-label="Enrollment progress">
      {STEPS.map((step, i) => {
        const done = i < idx || (i === idx && idx === STEPS.length - 1);
        const current = i === idx && !done;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${done ? 'bg-emerald-600' : current ? 'bg-red-700' : 'bg-slate-200'}`}
              aria-hidden
            />
            <span
              className={`truncate text-[11px] ${current ? 'font-semibold text-red-800' : 'hidden sm:block'} ${current ? '' : done ? 'text-slate-600' : 'text-slate-400'}`}
              aria-current={current ? 'step' : undefined}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useAuth();

  const canAttendance = hasPermission('attendance.view');
  const canInvoices = hasPermission('invoices.view');
  const canCertificates = hasPermission('certificates.view');

  const { data, isLoading, isError } = useQuery<StudentDetail>({
    queryKey: ['students', params.id],
    queryFn: async () => (await apiClient.get(`/v1/students/${params.id}`)).data,
  });

  const programsQuery = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
    enabled: hasPermission('programs.view'),
  });
  const batchesQuery = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: async () => (await apiClient.get('/v1/batches')).data,
    enabled: hasPermission('batches.view'),
  });
  const branchesQuery = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: hasPermission('branches.view'),
  });
  const attendanceQuery = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', 'student', params.id],
    queryFn: async () => (await apiClient.get('/v1/attendance', { params: { studentId: params.id } })).data,
    enabled: canAttendance,
  });
  const invoicesQuery = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => (await apiClient.get('/v1/invoices')).data,
    enabled: canInvoices,
  });
  const certificatesQuery = useQuery<Certificate[]>({
    queryKey: ['certificates'],
    queryFn: async () => (await apiClient.get('/v1/certificates')).data,
    enabled: canCertificates,
  });

  const programName = new Map((programsQuery.data ?? []).map((p) => [p.id, p.name]));
  const batchById = new Map((batchesQuery.data ?? []).map((b) => [b.id, b]));
  const branchName = new Map((branchesQuery.data ?? []).map((b) => [b.id, b.name]));

  const enrollments = [...(data?.enrollments ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const enrollmentIds = new Set(enrollments.map((e) => e.id));
  const current = enrollments.find((e) => e.status === 'ENROLLED') ?? enrollments[0];

  const attendance = [...(attendanceQuery.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const attCounts = (Object.keys(ATTENDANCE_META) as AttendanceRecord['status'][]).map((s) => ({
    status: s,
    name: ATTENDANCE_META[s].label,
    value: attendance.filter((r) => r.status === s).length,
    fill: ATTENDANCE_META[s].color,
  }));
  const attended = attendance.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const attendanceRate = attendance.length ? Math.round((attended / attendance.length) * 100) : null;

  const byClass = new Map<string, { name: string; total: number; attended: number }>();
  for (const r of attendance) {
    const row = byClass.get(r.class.id) ?? { name: r.class.name, total: 0, attended: 0 };
    row.total += 1;
    if (r.status === 'PRESENT' || r.status === 'LATE') row.attended += 1;
    byClass.set(r.class.id, row);
  }

  const invoices = (invoicesQuery.data ?? []).filter((inv) => enrollmentIds.has(inv.enrollmentId));
  const openInvoices = invoices.filter((inv) => inv.status !== 'CANCELLED');
  const billed = openInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const paid = openInvoices.reduce((sum, inv) => sum + netPaid(inv), 0);
  const balance = Math.max(0, billed - paid);

  const certificates = (certificatesQuery.data ?? []).filter((c) => c.studentId === params.id);

  const fullName = data ? `${data.user.firstName} ${data.user.lastName}` : 'Student';

  return (
    <div>
      <Link
        href="/students"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-red-700"
      >
        {icons.back}
        Students
      </Link>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load this student. They may be outside your access scope, or the link is out of date." />}

      {data && (
        <>
          <Card className="mb-6 p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-red-50 text-xl font-semibold text-red-800">
                {data.user.firstName.charAt(0)}
                {data.user.lastName.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900">{fullName}</h1>
                  <StatusBadge status={data.user.status} />
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
                  <li className="flex min-w-0 items-center gap-1.5">
                    <span className="text-slate-400">{icons.mail}</span>
                    <a href={`mailto:${data.user.email}`} className="truncate hover:text-red-700 hover:underline">
                      {data.user.email}
                    </a>
                  </li>
                  {data.user.phone && (
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-400">{icons.phone}</span>
                      <a href={`tel:${data.user.phone.replace(/\s/g, '')}`} className="hover:text-red-700 hover:underline">
                        {data.user.phone}
                      </a>
                    </li>
                  )}
                  {data.branchId && branchName.has(data.branchId) && (
                    <li className="flex items-center gap-1.5">
                      <span className="text-slate-400">{icons.pin}</span>
                      {branchName.get(data.branchId)}
                    </li>
                  )}
                  <li className="flex items-center gap-1.5">
                    <span className="text-slate-400">{icons.calendar}</span>
                    Added {longDate(data.createdAt)}
                  </li>
                </ul>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 lg:grid-cols-4">
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="text-slate-400">{icons.grad}</span>
                  Program
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {current ? programName.get(current.programId) ?? 'Enrolled' : 'Not enrolled'}
                </dd>
              </div>
              {canAttendance && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-400">{icons.check}</span>
                    Attendance
                  </dt>
                  <dd className={`mt-1 text-sm font-semibold tabular-nums ${attendanceRate !== null && attendanceRate < 75 ? 'text-red-700' : 'text-slate-900'}`}>
                    {attendanceQuery.isLoading ? '…' : attendanceRate === null ? 'No sessions yet' : `${attendanceRate}% of ${attendance.length}`}
                  </dd>
                </div>
              )}
              {canInvoices && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-400">{icons.wallet}</span>
                    Balance due
                  </dt>
                  <dd className={`mt-1 text-sm font-semibold tabular-nums ${balance > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {invoicesQuery.isLoading ? '…' : invoices.length === 0 ? 'No invoices' : balance > 0 ? pesos(balance) : 'Paid in full'}
                  </dd>
                </div>
              )}
              {canCertificates && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-slate-400">{icons.award}</span>
                    Certificates
                  </dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                    {certificatesQuery.isLoading ? '…' : certificates.length}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-6">
              <SectionCard icon={icons.grad} title="Enrollments" meta={enrollments.length ? String(enrollments.length) : undefined}>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-slate-500">No enrollments yet. Start one from the Enrollments page.</p>
                ) : (
                  <ul className="space-y-4">
                    {enrollments.map((e) => {
                      const batch = e.batchId ? batchById.get(e.batchId) : undefined;
                      return (
                        <li key={e.id} className="rounded-lg border border-slate-100 p-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900">{programName.get(e.programId) ?? 'Program'}</div>
                              <div className="text-xs text-slate-500">
                                {batch ? `${batch.name} · starts ${longDate(batch.startDate)}` : 'No batch yet'} · applied {longDate(e.createdAt)}
                              </div>
                            </div>
                            <StatusBadge status={e.status} />
                          </div>
                          <StepTrack status={e.status} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              {canAttendance && (
                <SectionCard icon={icons.check} title="Attendance" meta={attendance.length ? `${attendance.length} sessions` : undefined}>
                  {attendanceQuery.isLoading ? (
                    <LoadingState />
                  ) : attendanceQuery.isError ? (
                    <ErrorState message="Could not load attendance." />
                  ) : attendance.length === 0 ? (
                    <p className="text-sm text-slate-500">No attendance recorded yet.</p>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)]">
                      <div className="relative mx-auto h-40 w-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={attCounts.filter((c) => c.value > 0)}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={50}
                              outerRadius={72}
                              paddingAngle={2}
                              strokeWidth={0}
                              isAnimationActive={false}
                            />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-2xl font-bold tabular-nums text-slate-900">{attendanceRate}%</div>
                          <div className="text-xs text-slate-500">attended</div>
                        </div>
                      </div>
                      <div className="min-w-0 space-y-4">
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                          {attCounts.map((c) => (
                            <li key={c.status} className="flex items-center gap-1.5 text-slate-600">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.fill }} />
                              {c.name}
                              <span className="ml-auto font-semibold tabular-nums text-slate-900 sm:ml-1">{c.value}</span>
                            </li>
                          ))}
                        </ul>
                        {byClass.size > 1 && (
                          <ul className="space-y-2">
                            {[...byClass.values()].map((c) => {
                              const pct = Math.round((c.attended / c.total) * 100);
                              return (
                                <li key={c.name}>
                                  <div className="mb-1 flex justify-between text-xs">
                                    <span className="truncate text-slate-700">{c.name}</span>
                                    <span className="tabular-nums text-slate-500">
                                      {pct}% · {c.total}
                                    </span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className={`h-full rounded-full ${pct < 75 ? 'bg-red-700' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div>
                          <p className="mb-2 text-xs font-medium text-slate-500">Latest sessions</p>
                          <ol className="flex flex-wrap gap-1.5">
                            {attendance.slice(0, 14).map((r) => (
                              <li
                                key={r.id}
                                title={`${longDate(r.date)} · ${r.class.name} · ${ATTENDANCE_META[r.status].label}`}
                                className="flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-medium tabular-nums text-white"
                                style={{ backgroundColor: ATTENDANCE_META[r.status].color }}
                              >
                                {new Date(r.date).getUTCDate()}
                              </li>
                            ))}
                          </ol>
                          <p className="mt-1.5 text-[11px] text-slate-400">Newest first. Hover a day for the class and date.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </SectionCard>
              )}

              {canInvoices && (
                <SectionCard icon={icons.wallet} title="Billing" meta={invoices.length ? `${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}` : undefined}>
                  {invoicesQuery.isLoading ? (
                    <LoadingState />
                  ) : invoicesQuery.isError ? (
                    <ErrorState message="Could not load invoices." />
                  ) : invoices.length === 0 ? (
                    <p className="text-sm text-slate-500">No invoices for this student yet.</p>
                  ) : (
                    <>
                      <div className="mb-4">
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                          <span className="text-slate-500">
                            Paid <span className="font-semibold tabular-nums text-slate-900">{pesos(paid)}</span> of{' '}
                            <span className="tabular-nums">{pesos(billed)}</span>
                          </span>
                          {balance > 0 && <span className="font-semibold tabular-nums text-red-700">{pesos(balance)} due</span>}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${billed ? Math.min(100, (paid / billed) * 100) : 0}%` }} />
                        </div>
                      </div>
                      <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {invoices.map((inv) => {
                          const invPaid = netPaid(inv);
                          return (
                            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900">{inv.enrollment?.program?.name ?? 'Invoice'}</div>
                                <div className="text-xs text-slate-500">
                                  Issued {longDate(inv.createdAt)}
                                  {inv.dueDate && ` · due ${longDate(inv.dueDate)}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-right text-xs tabular-nums text-slate-500">
                                  <span className="block text-sm font-semibold text-slate-900">{pesos(inv.totalAmount)}</span>
                                  {invPaid > 0 && inv.status !== 'PAID' && `${pesos(invPaid)} paid`}
                                </span>
                                <StatusBadge status={inv.status} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </SectionCard>
              )}
            </div>

            <div className="space-y-6">
              <SectionCard icon={icons.person} title="Profile">
                <dl className="-my-2.5 divide-y divide-slate-100">
                  <Detail label="Date of birth">
                    {data.dateOfBirth ? (
                      <>
                        {longDate(data.dateOfBirth)} <span className="text-slate-500">· {ageFrom(data.dateOfBirth)} years old</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </Detail>
                  <Detail label="Address">{data.address ?? <span className="text-slate-400">Not provided</span>}</Detail>
                  <Detail label="Education">
                    {data.educationBackground ?? <span className="text-slate-400">Not provided</span>}
                  </Detail>
                </dl>
              </SectionCard>

              <SectionCard icon={icons.lifebuoy} title="Emergency contact">
                {data.emergencyContactName ? (
                  <div>
                    <div className="text-sm font-medium text-slate-900">{data.emergencyContactName}</div>
                    {data.emergencyContactPhone ? (
                      <a
                        href={`tel:${data.emergencyContactPhone.replace(/\s/g, '')}`}
                        className="mt-1 inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline"
                      >
                        {icons.phone}
                        {data.emergencyContactPhone}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">No phone number on file</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">No emergency contact on file.</p>
                )}
              </SectionCard>

              {canCertificates && (
                <SectionCard icon={icons.award} title="Certificates">
                  {certificatesQuery.isLoading ? (
                    <LoadingState />
                  ) : certificates.length === 0 ? (
                    <p className="text-sm text-slate-500">None issued yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {certificates.map((c) => (
                        <li key={c.id} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">{icons.award}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">{c.program?.name ?? 'Certificate'}</div>
                            <div className="text-xs text-slate-500">
                              {c.certificateNumber} · {longDate(c.issuedAt)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
