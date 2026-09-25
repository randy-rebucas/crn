'use client';

import { MaterialLibrary } from '@/components/student-library';

export default function StudentMaterialsPage() {
  return (
    <MaterialLibrary
      types={['PDF', 'DOCUMENT', 'TEXT', 'DOWNLOAD', 'IMAGE', 'AUDIO', 'FLASHCARD']}
      title="Study Materials"
      description="Handouts, notes, and downloadable resources for your program."
      emptyTitle="No study materials yet"
    />
  );
}
