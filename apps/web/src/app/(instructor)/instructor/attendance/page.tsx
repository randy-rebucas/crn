import { AttendanceView } from '@/components/attendance-view';

export default async function InstructorAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string | string[] }>;
}) {
  const { classId } = await searchParams;
  return <AttendanceView myClassesOnly initialClassId={typeof classId === 'string' ? classId : undefined} />;
}
