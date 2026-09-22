import type { Metadata } from 'next';
import { API_BASE_URL } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Success Stories',
  description: 'Real graduates, real results — success stories from OBIAS Nursing & Allied Courses Review Center.',
};

interface PublicSuccessStory {
  id: string;
  graduateName: string;
  programName: string;
  year: number | null;
  testimonial: string;
  photoUrl: string | null;
}

async function getSuccessStories(): Promise<PublicSuccessStory[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/success-stories`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function SuccessStoriesPage() {
  const stories = await getSuccessStories();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Success Stories</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Hear from graduates who reviewed with us.</p>

      {stories.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Success stories are being gathered — check back soon.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <div key={story.id} className="rounded-xl border border-slate-200 bg-brand-cream p-6">
              <p className="text-sm italic text-slate-700">&ldquo;{story.testimonial}&rdquo;</p>
              <p className="mt-4 font-heading font-semibold text-slate-900">{story.graduateName}</p>
              <p className="text-xs text-slate-500">
                {story.programName}
                {story.year ? ` · ${story.year}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
