'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function MarketingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-heading text-3xl font-bold text-slate-900">We couldn&apos;t load this page</h1>
      <p className="mt-3 text-slate-600">
        Something went wrong on our side. Please try again in a moment, or reach us directly — enrollment inquiries are
        still open.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Try again
        </button>
        <Link
          href="/contact"
          className="rounded-md border-2 border-brand-maroon px-6 py-3 text-sm font-semibold text-brand-maroon hover:bg-brand-maroon hover:text-white"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
