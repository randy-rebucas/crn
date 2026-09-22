'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { StudentShell, StudentPageHeader, Chevron } from '@/components/student-ui';
import { pickActiveEnrollment, useMyEnrollments, useMyStudentProfile } from '@/lib/student-hooks';

// GAP: Course/Subject/Module/Lesson/Material list endpoints (apps/api/src/
// modules/{courses,subjects,curriculum}) don't filter by ContentStatus
// server-side, so PUBLISHED-only filtering happens client-side at every
// level here. This is a mobile drill-down accordion rather than one giant
// nested tree: each tap reveals one more level and fetches it lazily, so a
// phone screen never has to render a five-deep outline at once.

interface Course {
  id: string;
  name: string;
  code: string;
  status: string;
}
interface Subject {
  id: string;
  name: string;
  status: string;
}
interface ModuleItem {
  id: string;
  name: string;
  status: string;
}
interface Lesson {
  id: string;
  name: string;
  status: string;
}
interface Material {
  id: string;
  title: string;
  type: string;
  status: string;
}

const MATERIAL_ICON: Record<string, string> = {
  TEXT: '📄',
  IMAGE: '🖼️',
  PDF: '📕',
  DOCUMENT: '📃',
  VIDEO: '🎬',
  AUDIO: '🎧',
  DOWNLOAD: '⬇️',
  FLASHCARD: '🗂️',
};

function usePublishedList<T extends { status: string }>(
  key: unknown[],
  url: string,
  params: Record<string, string>,
  enabled: boolean,
) {
  return useQuery<T[]>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<T[]>(url, { params });
      return data.filter((item) => item.status === 'PUBLISHED');
    },
  });
}

function Row({
  label,
  sublabel,
  open,
  onToggle,
}: {
  label: string;
  sublabel?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">{label}</span>
        {sublabel && <span className="block truncate text-xs text-slate-500">{sublabel}</span>}
      </span>
      <Chevron open={open} />
    </button>
  );
}

function MaterialsList({ lessonId }: { lessonId: string }) {
  const materials = usePublishedList<Material>(['learn-materials', lessonId], '/v1/materials', { lessonId }, true);

  if (materials.isLoading) return <p className="px-3 py-2 text-xs text-slate-400">Loading materials…</p>;
  if (materials.isError) return <p className="px-3 py-2 text-xs text-red-600">Could not load materials.</p>;
  if (!materials.data || materials.data.length === 0) {
    return <p className="px-3 py-2 text-xs text-slate-400">No published materials yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1 py-1 pl-3">
      {materials.data.map((m) => (
        <li key={m.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
          <span aria-hidden>{MATERIAL_ICON[m.type] ?? '📄'}</span>
          <span className="truncate text-sm text-slate-700">{m.title}</span>
        </li>
      ))}
    </ul>
  );
}

function LessonsList({ moduleId }: { moduleId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lessons = usePublishedList<Lesson>(['learn-lessons', moduleId], '/v1/lessons', { moduleId }, true);

  if (lessons.isLoading) return <p className="px-3 py-2 text-xs text-slate-400">Loading lessons…</p>;
  if (lessons.isError) return <p className="px-3 py-2 text-xs text-red-600">Could not load lessons.</p>;
  if (!lessons.data || lessons.data.length === 0) {
    return <p className="px-3 py-2 text-xs text-slate-400">No published lessons yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100 pl-3">
      {lessons.data.map((lesson) => {
        const open = openId === lesson.id;
        return (
          <li key={lesson.id}>
            <Row label={lesson.name} open={open} onToggle={() => setOpenId(open ? null : lesson.id)} />
            {open && <MaterialsList lessonId={lesson.id} />}
          </li>
        );
      })}
    </ul>
  );
}

function ModulesList({ subjectId }: { subjectId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const modules = usePublishedList<ModuleItem>(['learn-modules', subjectId], '/v1/modules', { subjectId }, true);

  if (modules.isLoading) return <p className="px-3 py-2 text-xs text-slate-400">Loading modules…</p>;
  if (modules.isError) return <p className="px-3 py-2 text-xs text-red-600">Could not load modules.</p>;
  if (!modules.data || modules.data.length === 0) {
    return <p className="px-3 py-2 text-xs text-slate-400">No published modules yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100 pl-3">
      {modules.data.map((mod) => {
        const open = openId === mod.id;
        return (
          <li key={mod.id}>
            <Row label={mod.name} open={open} onToggle={() => setOpenId(open ? null : mod.id)} />
            {open && <LessonsList moduleId={mod.id} />}
          </li>
        );
      })}
    </ul>
  );
}

function SubjectsList({ courseId }: { courseId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const subjects = usePublishedList<Subject>(['learn-subjects', courseId], '/v1/subjects', { courseId }, true);

  if (subjects.isLoading) return <p className="px-3 py-2 text-xs text-slate-400">Loading subjects…</p>;
  if (subjects.isError) return <p className="px-3 py-2 text-xs text-red-600">Could not load subjects.</p>;
  if (!subjects.data || subjects.data.length === 0) {
    return <p className="px-3 py-2 text-xs text-slate-400">No published subjects yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-100 pl-3">
      {subjects.data.map((subject) => {
        const open = openId === subject.id;
        return (
          <li key={subject.id}>
            <Row label={subject.name} open={open} onToggle={() => setOpenId(open ? null : subject.id)} />
            {open && <ModulesList subjectId={subject.id} />}
          </li>
        );
      })}
    </ul>
  );
}

export default function LearnPage() {
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const active = pickActiveEnrollment(enrollments.data);
  const programId = active?.programId;

  const courses = usePublishedList<Course>(
    ['learn-courses', programId],
    '/v1/courses',
    { programId: programId ?? '' },
    Boolean(programId),
  );

  const isLoading = profile.isLoading || enrollments.isLoading;
  const isError = profile.isError || enrollments.isError;

  return (
    <StudentShell>
      <StudentPageHeader title="Learn" description={active ? active.program.name : 'Your enrolled program content'} />

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load your enrollment." />}

      {!isLoading && !isError && !active && (
        <EmptyState
          title="No active enrollment"
          description="Once you're enrolled in a program, its courses will show up here."
        />
      )}

      {!isLoading && !isError && active && (
        <>
          {courses.isLoading && <LoadingState />}
          {courses.isError && <ErrorState message="Could not load courses." />}
          {courses.data && courses.data.length === 0 && (
            <EmptyState
              title="Nothing published yet"
              description="Your program's courses haven't been published for students yet."
            />
          )}
          {courses.data && courses.data.length > 0 && (
            <Card className="overflow-hidden">
              <ul className="flex flex-col divide-y divide-slate-100">
                {courses.data.map((course) => {
                  const open = openCourseId === course.id;
                  return (
                    <li key={course.id}>
                      <Row
                        label={course.name}
                        sublabel={course.code}
                        open={open}
                        onToggle={() => setOpenCourseId(open ? null : course.id)}
                      />
                      {open && <SubjectsList courseId={course.id} />}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </StudentShell>
  );
}
