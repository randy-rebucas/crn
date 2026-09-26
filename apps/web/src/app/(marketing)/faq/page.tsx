import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import { listFaqItems } from '@/lib/public-api';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about OBIAS Nursing & Allied Courses Review Center.',
};

export default async function FaqPage() {
  const items = await listFaqItems();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Frequently Asked Questions</h1>
      <p className="mt-2 text-slate-600">Answers to common questions about our programs and enrollment.</p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">FAQs are being prepared — please contact us with any questions.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <details key={item.id} className="group rounded-xl border border-slate-200 bg-brand-cream p-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-heading font-semibold text-slate-900">
                {item.question}
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-brand-maroon transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="mt-3 space-y-2 text-sm text-slate-600 [&_a]:text-brand-maroon [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                <ReactMarkdown>{item.answer}</ReactMarkdown>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
