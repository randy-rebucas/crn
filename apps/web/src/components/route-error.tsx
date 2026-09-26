'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Shared error boundary body for the signed-in portals. It renders inside the
// portal's layout (error.tsx doesn't wrap its own segment's layout), so the
// nav stays usable and only the page area shows this.
export function RouteError({
  error,
  retry,
  homeHref,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  homeHref: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-16 text-center" role="alert">
      <h1 className="text-xl font-semibold text-slate-900">This page ran into a problem</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Something went wrong while showing it. Try again, and if it keeps happening, go back and reopen it.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-[42px] items-center rounded-md bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Try again
        </button>
        <Link
          href={homeHref}
          className="inline-flex min-h-[42px] items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Go to home
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-slate-400">Reference: {error.digest}</p>}
    </div>
  );
}
