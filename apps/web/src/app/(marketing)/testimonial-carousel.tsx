'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  photo: string;
}

// Three-up grid on desktop; below lg the same cards become a swipeable strip
// whose dots track (and jump to) the card in view.
export function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root: track, threshold: 0.6 },
    );
    Array.from(track.children).forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  const goTo = (index: number) => {
    const card = trackRef.current?.children[index] as HTMLElement | undefined;
    trackRef.current?.scrollTo({ left: card ? card.offsetLeft - trackRef.current.offsetLeft : 0, behavior: 'smooth' });
  };

  return (
    <div>
      <div
        ref={trackRef}
        className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-3 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0"
      >
        {items.map((t, i) => (
          <figure
            key={t.name}
            data-index={i}
            className="flex w-[86%] shrink-0 snap-start items-center gap-4 rounded-lg bg-white p-4 shadow-[0_6px_20px_-8px_rgb(15_30_61/0.18)] ring-1 ring-slate-900/5 sm:w-[60%] lg:w-auto"
          >
            <Image
              src={t.photo}
              alt={`${t.name}, ${t.role}`}
              width={290}
              height={279}
              className="h-24 w-24 shrink-0 rounded-full object-cover sm:h-[6.5rem] sm:w-[6.5rem]"
            />
            <div className="min-w-0">
              <Icon name="quote" className="h-4 w-4 text-brand-maroon" />
              <blockquote className="mt-1 text-[0.8125rem] leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-3">
                <p className="text-sm font-semibold text-brand-navy">{t.name}</p>
                <p className="text-[0.8125rem] text-slate-500">{t.role}</p>
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-2.5 lg:hidden">
        {items.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show testimonial from ${t.name}`}
            aria-current={active === i ? 'true' : undefined}
            className="flex h-6 w-6 items-center justify-center"
          >
            <span className={`h-3 w-3 rounded-full transition-colors ${active === i ? 'bg-brand-maroon' : 'bg-slate-300'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
