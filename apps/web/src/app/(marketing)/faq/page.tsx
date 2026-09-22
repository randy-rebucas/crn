import type { Metadata } from 'next';
import { API_BASE_URL } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about OBIAS Nursing & Allied Courses Review Center.',
};

interface PublicFaqItem {
  id: string;
  question: string;
  answer: string;
}

async function getFaqItems(): Promise<PublicFaqItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/faq`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function FaqPage() {
  const items = await getFaqItems();

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
              <summary className="cursor-pointer list-none font-heading font-semibold text-slate-900">
                {item.question}
              </summary>
              <p className="mt-3 text-sm text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
