'use client';

import { ExamCatalog } from '@/components/student-exam-list';
import { icons } from '@/components/student-ui';

export default function StudentQuizzesPage() {
  return (
    <ExamCatalog
      types={['PRACTICE', 'DIAGNOSTIC']}
      icon={icons.quiz}
      title="Quizzes"
      description="Shorter practice and diagnostic checks to test what you know."
      emptyTitle="No quizzes yet"
    />
  );
}
