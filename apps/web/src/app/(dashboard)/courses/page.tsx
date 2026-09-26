'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';
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

interface Program {
  id: string;
  name: string;
  status?: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  programId: string;
  status?: string;
  program: { id: string; name: string };
  _count: { subjects: number };
}

interface ClassRecord {
  id: string;
  name: string;
  status: string;
  course: { id: string };
}

const icons = {
  grad: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2M21 9.5V14" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 6.5C4 5.7 4.7 5 6 5h5v14H6c-1.3 0-2-.7-2-1.5v-11ZM20 6.5c0-.8-.7-1.5-2-1.5h-5v14h5c1.3 0 2-.7 2-1.5v-11Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
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
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={8.5} cy={8} r={3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={9.5} r={2.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3 20c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 20c.6-2.4 2-4 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
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
  alert: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M12 4 21 19.5H3L12 4Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={12} cy={16.8} r={0.9} fill="currentColor" />
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

const createCourseSchema = z.object({
  programId: z.string().min(1, 'Choose a program'),
  name: z.string().trim().min(1, 'Give the course a name'),
  code: z
    .string()
    .trim()
    .min(1, 'Add a course code')
    .max(20, 'Keep the code under 20 characters'),
  description: z.string().optional(),
});
type CreateCourseValues = z.infer<typeof createCourseSchema>;

function CreateCourseForm({
  programs,
  courses,
  defaultProgramId,
  onCreated,
}: {
  programs: Program[];
  courses: Course[];
  defaultProgramId: string;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, control, formState } = useForm<CreateCourseValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { programId: defaultProgramId, name: '', code: '', description: '' },
  });
  const [programId, code] = useWatch({ control, name: ['programId', 'code'] });
  const clash = courses.find(
    (c) => c.programId === programId && code.trim() !== '' && c.code.toLowerCase() === code.trim().toLowerCase(),
  );

  const onSubmit = async (values: CreateCourseValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/courses', {
        ...values,
        code: values.code.toUpperCase(),
        description: values.description?.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the course. Check your connection and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Program" error={formState.errors.programId?.message}>
        <Select {...register('programId')}>
          <option value="" disabled>
            Select program…
          </option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
        <Field label="Name" error={formState.errors.name?.message}>
          <Input placeholder="e.g. Fundamentals of Nursing" {...register('name')} />
        </Field>
        <Field label="Code" error={formState.errors.code?.message}>
          <Input placeholder="NUR-101" style={{ textTransform: 'uppercase' }} {...register('code')} />
        </Field>
      </div>
      {clash && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-amber-700">
          {icons.alert}
          {clash.name} already uses this code in the program.
        </p>
      )}
      <Field label="Description">
        <Textarea placeholder="Optional — what the course covers" rows={4} {...register('description')} />
      </Field>
      <p className="text-xs text-slate-500">
        New courses start as drafts. Add subjects and lessons for it on the Curriculum page.
      </p>
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Creating…' : 'Create course'}
        </Button>
      </div>
    </form>
  );
}

export default function CoursesPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [programFilter, setProgramFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const canClasses = hasPermission('classes.view');
  const canPrograms = hasPermission('programs.view');

  // Every visible course in one request, each carrying its program's name and
  // subject count — this page used to fetch per program, then per course.
  const coursesQuery = useQuery<Course[]>({
    queryKey: ['courses', 'all'],
    queryFn: async () => (await apiClient.get('/v1/courses')).data,
  });
  const courses = coursesQuery.data ?? [];
  const coursesLoading = coursesQuery.isLoading;
  const coursesError = coursesQuery.isError;

  // The program list (so empty programs still show) needs programs.view;
  // without it, programs are the ones the visible courses belong to.
  const programsQuery = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
    enabled: canPrograms,
  });
  const programs: Program[] =
    programsQuery.data ?? [...new Map(courses.map((c) => [c.program.id, c.program])).values()];

  const subjectCount = new Map(courses.map((c) => [c.id, c._count.subjects]));

  const classesQuery = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
    enabled: canClasses,
  });
  const classesByCourse = new Map<string, ClassRecord[]>();
  for (const cls of classesQuery.data ?? []) {
    classesByCourse.set(cls.course.id, [...(classesByCourse.get(cls.course.id) ?? []), cls]);
  }

  const totalSubjects = [...subjectCount.values()].reduce<number>((sum, n) => sum + n, 0);

  const q = search.trim().toLowerCase();
  const visibleByProgram = programs
    .filter((p) => programFilter === 'ALL' || p.id === programFilter)
    .map((p) => ({
      program: p,
      courses: courses.filter(
        (c) =>
          c.programId === p.id &&
          (!q || `${c.name} ${c.code} ${c.description ?? ''}`.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.courses.length > 0 || (!q && programFilter !== 'ALL'));
  const visibleCount = visibleByProgram.reduce((sum, g) => sum + g.courses.length, 0);

  // Coverage is about gaps: which courses exist on paper but have no
  // curriculum written or no class running them yet.
  const withSubjects = courses.filter((c) => (subjectCount.get(c.id) ?? 0) > 0);
  const withClasses = courses.filter((c) => (classesByCourse.get(c.id)?.length ?? 0) > 0);
  const noCurriculum = courses.filter((c) => subjectCount.get(c.id) === 0);
  const chartData = programs
    .map((p) => {
      const list = courses.filter((c) => c.programId === p.id);
      const ready = list.filter((c) => (subjectCount.get(c.id) ?? 0) > 0).length;
      return { name: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name, fullName: p.name, ready, empty: list.length - ready };
    })
    .filter((row) => row.ready + row.empty > 0);

  const defaultProgramId = programFilter !== 'ALL' ? programFilter : programs[0]?.id ?? '';

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Courses grouped under each program, scoped to your access."
        action={
          hasPermission('courses.create') &&
          canPrograms &&
          programs.length > 0 && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New course
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New course">
        <CreateCourseForm
          key={defaultProgramId}
          programs={programs}
          courses={courses}
          defaultProgramId={defaultProgramId}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['courses'] });
          }}
        />
      </Drawer>

      {coursesLoading && <LoadingState />}
      {coursesError && <ErrorState message="Could not load courses. Refresh the page to try again." />}
      {canPrograms && programsQuery.data && programs.length === 0 && (
        <EmptyState title="No programs yet" description="Create a program on the Programs page, then add its courses here." />
      )}
      {coursesQuery.data && courses.length === 0 && (!canPrograms || programs.length > 0) && (
        <EmptyState title="No courses yet" description="Create the first course for one of your programs." />
      )}

      {!coursesLoading && courses.length > 0 && (
        <>
          <Card className={`mb-6 grid grid-cols-2 lg:divide-x lg:divide-slate-100 ${canClasses ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {[
              { icon: icons.grad, label: 'Programs', value: programs.length },
              { icon: icons.book, label: 'Courses', value: courses.length },
              { icon: icons.list, label: 'Subjects', value: totalSubjects },
              ...(canClasses ? [{ icon: icons.users, label: 'Classes running them', value: classesQuery.data?.length ?? '…' }] : []),
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-4 sm:p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">{stat.icon}</span>
                <div className="min-w-0">
                  <div className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{stat.value}</div>
                  <div className="text-xs leading-snug text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </Card>

          <SectionCard
            icon={icons.barChart}
            title="Curriculum coverage"
            meta="Courses with subjects written, by program"
            className="mb-6"
          >
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ResponsiveContainer width="100%" height={Math.max(150, chartData.length * 40 + 30)}>
                  <BarChart data={chartData} layout="vertical" barCategoryGap="30%" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                      formatter={(value, key) => [`${value} ${value === 1 ? 'course' : 'courses'}`, key === 'ready' ? 'Has subjects' : 'No subjects yet']}
                    />
                    <Bar dataKey="ready" stackId="c" fill="#059669" isAnimationActive={false} />
                    <Bar dataKey="empty" stackId="c" fill="#e2e8f0" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                    Has subjects
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                    No subjects yet
                  </span>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-2">
                {[
                  { label: 'Courses with subjects', count: withSubjects.length, color: 'bg-emerald-600' },
                  ...(canClasses ? [{ label: 'Courses with a class running', count: withClasses.length, color: 'bg-amber-500' }] : []),
                ].map((m) => (
                  <div key={m.label}>
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-slate-600">{m.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {m.count} <span className="font-normal text-slate-400">of {courses.length}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${m.color}`} style={{ width: `${(m.count / courses.length) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {noCurriculum.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-2 text-xs font-medium text-slate-500">No subjects written yet</p>
                    <div className="flex flex-wrap gap-1.5">
                      {noCurriculum.map((c) => (
                        <span key={c.id} title={c.name} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {c.code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={icons.book}
            title="All courses"
            meta={visibleCount !== courses.length ? `${visibleCount} of ${courses.length}` : String(courses.length)}
            action={
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search courses</span>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, code, description"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                />
              </label>
            }
          >
            {programs.length > 1 && (
              <div className="-mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by program">
                {[{ id: 'ALL', name: 'All programs', count: courses.length }, ...programs.map((p) => ({ id: p.id, name: p.name, count: courses.filter((c) => c.programId === p.id).length }))].map(
                  (chip) => {
                    const on = programFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setProgramFilter(chip.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                          on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {chip.name}
                        <span className={`tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{chip.count}</span>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            {visibleCount === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No courses match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setProgramFilter('ALL');
                    }}
                    className="font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    show all courses
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {visibleByProgram.map(({ program, courses: list }) => (
                  <section key={program.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="text-slate-400">{icons.grad}</span>
                        {program.name}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {list.length} {list.length === 1 ? 'course' : 'courses'}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {list.map((course) => {
                        const subjects = subjectCount.get(course.id);
                        const classes = classesByCourse.get(course.id) ?? [];
                        return (
                          <li key={course.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_14rem] md:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                                  {course.code}
                                </span>
                                <span className="font-medium text-slate-900">{course.name}</span>
                                {course.status && <StatusBadge status={course.status} />}
                              </div>
                              {course.description ? (
                                <p className="mt-1.5 line-clamp-2 max-w-prose text-sm text-slate-600">{course.description}</p>
                              ) : (
                                <p className="mt-1.5 text-sm text-slate-400">No description yet.</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs md:justify-end">
                              <span className="flex items-center gap-1.5 text-slate-600">
                                <span className="text-slate-400">{icons.list}</span>
                                <span className="font-semibold tabular-nums text-slate-900">{subjects ?? '…'}</span>
                                {subjects === 1 ? 'subject' : 'subjects'}
                              </span>
                              {canClasses && (
                                <span className="flex items-center gap-1.5 text-slate-600">
                                  <span className="text-slate-400">{icons.users}</span>
                                  <span className="font-semibold tabular-nums text-slate-900">{classes.length}</span>
                                  {classes.length === 1 ? 'class' : 'classes'}
                                </span>
                              )}
                            </div>
                            {canClasses && classes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 md:col-span-2">
                                {classes.map((cls) => (
                                  <span key={cls.id} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${cls.status === 'ACTIVE' ? 'bg-emerald-600' : cls.status === 'SCHEDULED' ? 'bg-blue-600' : 'bg-slate-400'}`}
                                    />
                                    {cls.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                      {list.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">No courses in this program yet.</li>}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
