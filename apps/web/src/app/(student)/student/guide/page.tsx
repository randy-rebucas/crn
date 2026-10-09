'use client';

import { StudentShell } from '@/components/student-ui';
import { UserGuide } from '@/components/user-guide';

export default function StudentGuidePage() {
  return (
    <StudentShell>
      <UserGuide portal="student" supportHref="/student/help" />
    </StudentShell>
  );
}
