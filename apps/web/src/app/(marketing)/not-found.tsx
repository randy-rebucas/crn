import Link from 'next/link';

export default function MarketingNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">
        This page may have been moved or is no longer published. Our programs and enrollment details are a click away.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/offerings"
          className="rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          View programs
        </Link>
        <Link
          href="/"
          className="rounded-md border-2 border-brand-maroon px-6 py-3 text-sm font-semibold text-brand-maroon hover:bg-brand-maroon hover:text-white"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
