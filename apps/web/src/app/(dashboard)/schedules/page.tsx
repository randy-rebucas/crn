'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '@/components/ui';

interface ClassRecord {
  id: string;
  name: string;
  course: { name: string; code: string };
  batch: { name: string };
}

interface Schedule {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const createScheduleSchema = z.object({
  classId: z.string().min(1, 'Required'),
  dayOfWeek: z.string().min(1, 'Required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM 24h format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM 24h format'),
});
type CreateScheduleValues = z.infer<typeof createScheduleSchema>;

function CreateScheduleForm({
  classes,
  defaultClassId,
  onCreated,
}: {
  classes: ClassRecord[];
  defaultClassId?: string;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateScheduleValues>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: { classId: defaultClassId ?? '' },
  });

  const onSubmit = async (values: CreateScheduleValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/schedules', {
        classId: values.classId,
        dayOfWeek: Number(values.dayOfWeek),
        startTime: values.startTime,
        endTime: values.endTime,
      });
      reset();
      onCreated();
    } catch (err) {
      // Room/instructor conflicts come back as 400s with a descriptive message
      // from SchedulesService — surface it verbatim rather than re-deriving it.
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setServerError(message ?? 'Could not create schedule.');
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">New schedule</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Class" error={errors.classId?.message}>
          <Select {...register('classId')} defaultValue={defaultClassId ?? ''}>
            <option value="" disabled>
              Select class…
            </option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} — {cls.course.name} ({cls.batch.name})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Day of week" error={errors.dayOfWeek?.message}>
          <Select {...register('dayOfWeek')} defaultValue="">
            <option value="" disabled>
              Select day…
            </option>
            {DAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start time" error={errors.startTime?.message}>
          <Input type="time" {...register('startTime')} />
        </Field>
        <Field label="End time" error={errors.endTime?.message}>
          <Input type="time" {...register('endTime')} />
        </Field>
        <div className="flex items-end lg:col-span-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create schedule'}
          </Button>
        </div>
        {serverError && <p className="text-sm text-red-600 lg:col-span-4">{serverError}</p>}
      </form>
    </Card>
  );
}

export default function SchedulesPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const queryClient = useQueryClient();

  const { data: classes, isLoading: classesLoading } = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });

  const effectiveClassId = classFilter || classes?.[0]?.id || '';

  const { data, isLoading, isError } = useQuery<Schedule[]>({
    queryKey: ['schedules', effectiveClassId],
    queryFn: async () => (await apiClient.get('/v1/schedules', { params: { classId: effectiveClassId } })).data,
    enabled: Boolean(effectiveClassId),
  });

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Weekly meeting times for each class, with room and instructor conflict checks."
        action={
          hasPermission('schedules.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Schedule'}</Button>
          )
        }
      />

      <div className="mb-4 max-w-sm">
        <Field label="Class">
          <Select value={effectiveClassId} onChange={(e) => setClassFilter(e.target.value)} disabled={classesLoading}>
            {(classes ?? []).map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} — {cls.course.name} ({cls.batch.name})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {showForm && (
        <div className="mb-6">
          <CreateScheduleForm
            classes={classes ?? []}
            defaultClassId={effectiveClassId}
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['schedules'] });
            }}
          />
        </div>
      )}

      {!effectiveClassId && !classesLoading && (
        <EmptyState title="No classes yet" description="Create a class before scheduling meeting times." />
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load schedules." />}
      {!isLoading && !isError && effectiveClassId && data?.length === 0 && (
        <EmptyState title="No schedules yet" description="Add the first meeting time for this class." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((schedule) => (
                <tr key={schedule.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{DAY_LABELS[schedule.dayOfWeek]}</td>
                  <td className="px-4 py-3 text-slate-600">{schedule.startTime}</td>
                  <td className="px-4 py-3 text-slate-600">{schedule.endTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
