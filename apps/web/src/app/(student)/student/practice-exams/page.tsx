'use client';

import { ExamCatalog } from '@/components/student-exam-list';
import { icons } from '@/components/student-ui';

export default function StudentPracticeExamsPage() {
  return (
    <ExamCatalog
      types={['MOCK', 'FINAL']}
      icon={icons.practice}
      title="Practice Exams"
      description="Full-length mock board and final exams, timed like the real thing."
      emptyTitle="No practice exams yet"
    />
  );
}
