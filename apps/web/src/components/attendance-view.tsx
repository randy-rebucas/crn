'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, Select } from '@/components/ui';

interface ClassRecord {
  id: string;
  name: string;
  course: { name: string; code: string };
  batch: { id: string; name: string };
  instructor?: { user: { id: string } } | null;
}

interface RosterStudent {
  id: string;
  user: { firstName: string; lastName: string; email: string };
}

interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

const STATUS_OPTIONS: Attendance['status'][] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const STATUS_STYLES: Record<Attendance['status'], string> = {
  PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ABSENT: 'bg-red-100 text-red-700 border-red-200',
  LATE: 'bg-amber-100 text-amber-800 border-amber-200',
  EXCUSED: 'bg-blue-100 text-blue-700 border-blue-200',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Shared by (dashboard)/attendance (org-wide) and (instructor)/instructor/attendance
// (`myClassesOnly` narrows the class picker to sections the caller teaches) so the
// two shells don't fork the marking logic — only which classes are selectable differs.
export function AttendanceView({ myClassesOnly = false }: { myClassesOnly?: boolean }) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [classFilter, setClassFilter] = useState('');
  const [date, setDate] = useState(todayISO());
  const [markError, setMarkError] = useState<string | null>(null);

  const { data: allClasses, isLoading: classesLoading } = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });

  const classes = useMemo(
    () => (myClassesOnly ? (allClasses ?? []).filter((c) => c.instructor?.user.id === user?.id) : allClasses ?? []),
    [allClasses, myClassesOnly, user?.id],
  );

  const classId = classFilter || classes[0]?.id || '';

  const { data: roster = [], isLoading: rosterLoading } = useQuery<RosterStudent[]>({
    queryKey: ['classes', classId, 'roster'],
    queryFn: async () => (await apiClient.get(`/v1/classes/${classId}/roster`)).data,
    enabled: Boolean(classId),
  });

  const {
    data: attendanceRecords,
    isLoading: attendanceLoading,
    isError: attendanceError,
  } = useQuery<Attendance[]>({
    queryKey: ['attendance', classId],
    queryFn: async () => (await apiClient.get('/v1/attendance', { params: { classId } })).data,
    enabled: Boolean(classId),
  });

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const record of attendanceRecords ?? []) {
      // date comes back as an ISO datetime; compare by day only.
      if (record.date.slice(0, 10) === date) {
        map.set(record.studentId, record);
      }
    }
    return map;
  }, [attendanceRecords, date]);

  const mark = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: Attendance['status'] }) =>
      apiClient.post('/v1/attendance', { studentId, classId, date, status }),
    onSuccess: () => {
      setMarkError(null);
      queryClient.invalidateQueries({ queryKey: ['attendance', classId] });
    },
    onError: (err) => {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setMarkError(message ?? 'Could not mark attendance.');
    },
  });

  const canMark = hasPermission('attendance.create');

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={
          myClassesOnly
            ? 'Mark and review attendance for your classes on a given date.'
            : 'Mark and review attendance for a class on a given date.'
        }
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Class">
            <Select value={classId} onChange={(e) => setClassFilter(e.target.value)} disabled={classesLoading}>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} — {cls.course.name} ({cls.batch.name})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Card>

      {markError && <div className="mb-4"><ErrorState message={markError} /></div>}

      {!classId && !classesLoading && (
        <EmptyState
          title="No classes yet"
          description={myClassesOnly ? "You aren't assigned to any classes yet." : 'Create a class before taking attendance.'}
        />
      )}

      {(rosterLoading || attendanceLoading) && classId && <LoadingState />}
      {attendanceError && <ErrorState message="Could not load attendance records." />}

      {!rosterLoading && !attendanceLoading && classId && roster.length === 0 && (
        <EmptyState
          title="No enrolled students"
          description="No students are enrolled in this class's batch."
        />
      )}

      {!rosterLoading && !attendanceLoading && roster.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((student) => {
                const current = attendanceByStudent.get(student.id);
                return (
                  <tr key={student.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {student.user.firstName} {student.user.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{student.user.email}</td>
                    <td className="px-4 py-3">
                      {canMark ? (
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={mark.isPending}
                              onClick={() => mark.mutate({ studentId: student.id, status })}
                              className={`rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                                current?.status === status
                                  ? STATUS_STYLES[status]
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      ) : current ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[current.status]}`}
                        >
                          {current.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not marked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
