import Link from 'next/link';
import { Icon } from './icons';

// The maroon closing call-to-action that ends most marketing pages.
export function EnrollBand({
  title = 'Ready to start your journey?',
  subtitle = 'Enroll now and take the next step toward your healthcare career.',
  cta = 'Enroll Now',
}: {
  title?: string;
  subtitle?: string;
  cta?: string;
}) {
  return (
    <section className="bg-[linear-gradient(90deg,var(--brand-maroon-dark),var(--brand-maroon)_30%,var(--brand-maroon)_70%,var(--brand-maroon-dark))]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-8 text-center md:flex-row md:text-left">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-maroon">
          <Icon name="people" className="h-8 w-8" />
        </span>
        <div className="flex-1 text-white">
          <h2 className="text-[1.6rem] font-bold leading-tight font-sans! sm:text-[1.85rem]">{title}</h2>
          <p className="mt-1 text-white/85 sm:text-lg">{subtitle}</p>
        </div>
        <Link
          href="/contact"
          className="inline-flex shrink-0 items-center gap-2.5 rounded-md bg-white px-8 py-3 font-heading text-lg font-medium tracking-wide text-brand-maroon shadow-[0_6px_14px_-4px_rgb(0_0_0/0.3)] transition-colors hover:bg-brand-cream"
        >
          {cta}
          <Icon name="arrowRight" className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}
