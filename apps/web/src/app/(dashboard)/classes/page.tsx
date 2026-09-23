'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
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
} from '@/components/ui';

interface Branch {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  name: string;
  programId: string;
  branchId: string;
  program: { id: string; name: string };
}

interface Course {
  id: string;
  name: string;
  code: string;
  programId: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
  branchId: string;
}

interface InstructorProfile {
  id: string;
  user: { firstName: string; lastName: string };
}

interface ClassRecord {
  id: string;
  name: string;
  course: { id: string; name: string; code: string };
  batch: { id: string; name: string };
  room: Room | null;
  instructor: { id: string; user: { firstName: string; lastName: string } } | null;
}

const createClassSchema = z.object({
  batchId: z.string().min(1, 'Required'),
  courseId: z.string().min(1, 'Required'),
  branchId: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  instructorProfileId: z.string().optional(),
  roomId: z.string().optional(),
});
type CreateClassValues = z.infer<typeof createClassSchema>;

function CreateClassForm({
  batches,
  branches,
  rooms,
  instructors,
  onCreated,
}: {
  batches: Batch[];
  branches: Branch[];
  rooms: Room[];
  instructors: InstructorProfile[];
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateClassValues>({ resolver: zodResolver(createClassSchema) });

  const selectedBatchId = watch('batchId');
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const { data: courses } = useQuery<Course[]>({
    queryKey: ['courses', selectedBatch?.programId],
    queryFn: async () =>
      (await apiClient.get('/v1/courses', { params: { programId: selectedBatch?.programId } })).data,
    enabled: Boolean(selectedBatch?.programId),
  });

  const onSubmit = async (values: CreateClassValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/classes', {
        ...values,
        instructorProfileId: values.instructorProfileId || undefined,
        roomId: values.roomId || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setServerError(message ?? 'Could not create class.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Batch" error={errors.batchId?.message}>
        <Select {...register('batchId')} defaultValue="">
          <option value="" disabled>
            Select batch…
          </option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name} ({batch.program.name})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Course" error={errors.courseId?.message}>
        <Select {...register('courseId')} defaultValue="" disabled={!selectedBatchId}>
          <option value="" disabled>
            {selectedBatchId ? 'Select course…' : 'Select a batch first'}
          </option>
          {(courses ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} ({course.code})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Branch" error={errors.branchId?.message}>
        <Select {...register('branchId')} defaultValue="">
          <option value="" disabled>
            Select branch…
          </option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Class name" error={errors.name?.message}>
        <Input placeholder="Section A" {...register('name')} />
      </Field>
      <Field label="Instructor">
        <Select {...register('instructorProfileId')} defaultValue="">
          <option value="">Unassigned</option>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>
              {instructor.user.firstName} {instructor.user.lastName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Room">
        <Select {...register('roomId')} defaultValue="">
          <option value="">Unassigned</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </Select>
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create class'}
        </Button>
      </div>
    </form>
  );
}

const createRoomSchema = z.object({
  branchId: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  capacity: z.string().optional(),
});
type CreateRoomValues = z.infer<typeof createRoomSchema>;

function CreateRoomForm({ branches, onCreated }: { branches: Branch[]; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomValues>({ resolver: zodResolver(createRoomSchema) });

  const onSubmit = async (values: CreateRoomValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/rooms', {
        branchId: values.branchId,
        name: values.name,
        capacity: values.capacity ? Number(values.capacity) : undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setServerError(message ?? 'Could not create room.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Branch" error={errors.branchId?.message}>
        <Select {...register('branchId')} defaultValue="">
          <option value="" disabled>
            Select branch…
          </option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <Input placeholder="Room 101" {...register('name')} />
      </Field>
      <Field label="Capacity">
        <Input type="number" min={1} placeholder="Optional" {...register('capacity')} />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create room'}
        </Button>
      </div>
    </form>
  );
}

function ClassesTab() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });
  const { data: batches } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: async () => (await apiClient.get('/v1/batches')).data,
  });
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
  });
  const { data: rooms } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => (await apiClient.get('/v1/rooms')).data,
  });
  const { data: instructors } = useQuery<InstructorProfile[]>({
    queryKey: ['instructors'],
    queryFn: async () => (await apiClient.get('/v1/instructors')).data,
  });

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Class sections tied to a batch, course, room, and instructor."
        action={
          hasPermission('classes.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Class'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New class">
        <CreateClassForm
          batches={batches ?? []}
          branches={branches ?? []}
          rooms={rooms ?? []}
          instructors={instructors ?? []}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['classes'] });
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load classes." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No classes yet" description="Create the first class section." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{cls.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {cls.course.name} ({cls.course.code})
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cls.batch.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {cls.instructor ? `${cls.instructor.user.firstName} ${cls.instructor.user.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cls.room?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function RoomsTab() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => (await apiClient.get('/v1/rooms')).data,
  });
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
  });
  const branchesById = useMemo(() => new Map((branches ?? []).map((b) => [b.id, b.name])), [branches]);

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Physical rooms available for scheduling classes."
        action={
          hasPermission('rooms.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Room'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New room">
        <CreateRoomForm
          branches={branches ?? []}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load rooms." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No rooms yet" description="Create the first room for a branch." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((room) => (
                <tr key={room.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{room.name}</td>
                  <td className="px-4 py-3 text-slate-600">{branchesById.get(room.branchId) ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{room.capacity ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function ClassesPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'classes' | 'rooms'>('classes');
  const showRoomsTab = hasPermission('rooms.view');

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('classes')}
          className={`px-3 py-2 text-sm font-medium transition ${
            tab === 'classes' ? 'border-b-2 border-red-700 text-red-700' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Classes
        </button>
        {showRoomsTab && (
          <button
            onClick={() => setTab('rooms')}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === 'rooms' ? 'border-b-2 border-red-700 text-red-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Rooms
          </button>
        )}
      </div>
      {tab === 'classes' ? <ClassesTab /> : <RoomsTab />}
    </div>
  );
}
