import type { Metadata } from 'next';
import Link from 'next/link';

// Unmatched URLs anywhere in the app land here (the (marketing) group's
// not-found only covers notFound() calls inside that group). It renders in
// the root layout alone, with no site header, so it links out itself.

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-20">
      <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-brand-maroon">404</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">
        This page may have been moved, or the link was mistyped. Our programs and enrollment details are a click away.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Back to home
        </Link>
        <Link
          href="/login"
          className="rounded-md border-2 border-brand-maroon px-6 py-3 text-sm font-semibold text-brand-maroon hover:bg-brand-maroon hover:text-white"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
