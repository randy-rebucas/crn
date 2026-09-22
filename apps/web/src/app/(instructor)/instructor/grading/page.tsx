import { GradingView } from '@/components/grading-view';
import { PageHeader } from '@/components/ui';

export default function InstructorGradingPage() {
  return (
    <div>
      <PageHeader title="Grading" description="Score attempts awaiting manual review." />
      <GradingView />
    </div>
  );
}
