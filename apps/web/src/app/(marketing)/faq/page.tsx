import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { excerpt, listFaqItems } from '@/lib/public-api';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';
import { Icon } from '../icons';
import { EmailLink, InfoRow, PhoneList } from '../info-row';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about OBIAS Nursing & Allied Courses Review Center.',
};

export default async function FaqPage() {
  // Contact details fall back on their own, so only the FAQ list can be empty.
  const [items, contact] = await Promise.all([listFaqItems().catch(() => []), fetchPublicSettings()]);
  const phones = phonesOf(contact);

  // FAQPage structured data lets search engines show answers in results.
  const jsonLd = items.length > 0 && {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: excerpt(item.answer, 1000) },
    })),
  };

  const stillHaveQuestions = (
    <div className="rounded-xl bg-[#fdf1d6] px-6 py-6 ring-1 ring-[#f3e2b8]">
      <h2 className="text-lg font-bold text-brand-navy font-sans!">Still have questions?</h2>
      <p className="mt-1.5 text-sm text-slate-600">Our team is happy to help with programs, schedules, and fees.</p>
      <div className="mt-5 flex flex-col gap-6">
        {phones.length > 0 && (
          <InfoRow icon="phone" title="Call or text us">
            <PhoneList phones={phones} />
          </InfoRow>
        )}
        {contact.supportEmail && (
          <InfoRow icon="mail" title="Email">
            <EmailLink email={contact.supportEmail} />
          </InfoRow>
        )}
      </div>
      <Link
        href="/contact"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-maroon py-2.5 font-heading text-base font-medium tracking-wide text-white transition-colors hover:bg-brand-maroon-dark"
      >
        Send Us a Message
        <Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    </div>
  );

  return (
    <div>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src="/brands/marketing/resources/hero_people_studying.png"
          alt=""
          width={824}
          height={428}
          priority
          sizes="60vw"
          className="absolute bottom-0 right-0 w-[min(62vw,760px)] opacity-30 grayscale-[30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--brand-navy)_0%,rgb(15_30_61/0.9)_45%,rgb(15_30_61/0.5)_100%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 text-white sm:py-16">
          <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            Answers to common questions about our programs and enrollment.
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="mx-auto max-w-xl px-6 py-12 sm:py-14">
          <p className="mb-6 text-center text-slate-600">
            We&apos;re putting our FAQ together. In the meantime, reach out and we&apos;ll answer directly.
          </p>
          {stillHaveQuestions}
        </section>
      ) : (
        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[1fr_22rem] lg:gap-12">
          <div className="space-y-3">
            {items.map((item, i) => (
              <details
                key={item.id}
                open={i === 0}
                className="group rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_2px_8px_-4px_rgb(15_30_61/0.12)] open:ring-brand-maroon/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold text-brand-navy [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-xl leading-none text-white transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="space-y-2 px-6 pb-6 text-[0.95rem] leading-relaxed text-slate-600 [&_a]:text-brand-maroon [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-brand-navy">
                  <ReactMarkdown>{item.answer}</ReactMarkdown>
                </div>
              </details>
            ))}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">{stillHaveQuestions}</aside>
        </section>
      )}
    </div>
  );
}
