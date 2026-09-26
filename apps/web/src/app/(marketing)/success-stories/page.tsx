import type { Metadata } from 'next';
import Link from 'next/link';
import { listSuccessStories } from '@/lib/public-api';
import { Icon, type IconName } from '../icons';

export const metadata: Metadata = {
  title: 'Success Stories',
  description: 'Real graduates, real results — success stories from OBIAS Nursing & Allied Courses Review Center.',
};

const STATS: { value: string; label: string; icon: IconName }[] = [
  { value: 'Thousands', label: 'of Successful Reviewees', icon: 'people' },
  { value: 'High', label: 'Passing Rate', icon: 'chart' },
  { value: 'Many', label: 'Now Serving the Community', icon: 'heart' },
];

export default async function SuccessStoriesPage() {
  const stories = await listSuccessStories();

  return (
    <div>
      {/* Testimonials */}
      <section className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-[2.1rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans! sm:text-[2.6rem]">
            What Our Reviewees Say
          </h1>
          <p className="mt-2 text-slate-600">Real stories. Real results. Real healthcare professionals.</p>
        </div>

        {stories.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-500">Success stories are being gathered — check back soon.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {stories.map((story) => (
              <figure
                key={story.id}
                className="flex gap-4 rounded-xl bg-white px-6 py-6 ring-1 ring-slate-200 shadow-[0_4px_16px_-8px_rgb(15_30_61/0.18)]"
              >
                <Icon name="quote" className="mt-1 h-5 w-5 shrink-0 text-brand-maroon" />
                <div className="flex flex-1 flex-col">
                  <blockquote className="text-[0.95rem] leading-relaxed text-slate-600">&ldquo;{story.testimonial}&rdquo;</blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 pt-4">
                    {story.photoUrl && (
                      // Photos are admin-uploaded URLs from any host, so skip next/image's allowlist.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={story.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    )}
                    <span>
                      <span className="block font-semibold text-brand-navy">{story.graduateName}</span>
                      <span className="block text-sm text-slate-500">
                        {story.programName}
                        {story.year ? ` · ${story.year}` : ''}
                      </span>
                    </span>
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Stats band */}
      <section className="bg-brand-gold">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-y-8 px-6 py-10 text-center sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.value} className="flex flex-col items-center px-3">
              <Icon name={stat.icon} className="h-11 w-11 text-brand-maroon" />
              <p className="mt-2 text-[1.9rem] font-bold leading-none text-brand-navy">{stat.value}</p>
              <p className="mt-1.5 text-sm font-medium text-brand-navy">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-[linear-gradient(90deg,var(--brand-maroon-dark),var(--brand-maroon)_30%,var(--brand-maroon)_70%,var(--brand-maroon-dark))]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 py-9 text-center md:flex-row md:text-left">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-brand-maroon">
            <Icon name="people" className="h-8 w-8" />
          </span>
          <div className="flex-1 text-white">
            <h2 className="text-[1.6rem] font-bold leading-tight font-sans! sm:text-[1.85rem]">Be Our Next Success Story!</h2>
            <p className="mt-1 text-white/85">Enroll now and join thousands of healthcare professionals.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center gap-2.5 rounded-md bg-white px-8 py-3 font-heading text-lg font-medium tracking-wide text-brand-maroon shadow-[0_6px_14px_-4px_rgb(0_0_0/0.3)] transition-colors hover:bg-brand-cream"
          >
            Enroll Now
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
