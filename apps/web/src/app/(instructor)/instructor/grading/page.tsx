import { GradingView } from '@/components/grading-view';

export default function InstructorGradingPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-wide text-slate-900">Grading</h1>
        <p className="mt-1 text-sm text-slate-600">
          Essay and image-based answers wait here for a score. Oldest submissions come first.
        </p>
      </div>
      <GradingView />
    </div>
  );
}
