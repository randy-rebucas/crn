import type { Metadata } from 'next';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api-client';

// Public certificate check, the page behind a student's verification link.
// GET /v1/certificates/verify/:qrToken needs no auth and returns only the
// number, holder, program, and issue date, so that is all this shows.

export const metadata: Metadata = {
  title: 'Verify a Certificate',
  description: 'Confirm a certificate issued by OBIAS Nursing & Allied Courses Review Center.',
  robots: { index: false, follow: false },
};

interface VerifiedCertificate {
  certificateNumber: string;
  studentName: string;
  programName: string;
  issuedAt: string;
  valid: boolean;
}

type Lookup = { state: 'valid'; cert: VerifiedCertificate } | { state: 'not-found' } | { state: 'error' };

async function lookup(token: string): Promise<Lookup> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/certificates/verify/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (res.status === 404) return { state: 'not-found' };
    if (!res.ok) return { state: 'error' };
    const cert = (await res.json()) as VerifiedCertificate;
    return cert.valid ? { state: 'valid', cert } : { state: 'not-found' };
  } catch {
    return { state: 'error' };
  }
}

function Seal({ tone }: { tone: 'valid' | 'invalid' }) {
  return (
    <span
      className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full ring-4 ${
        tone === 'valid' ? 'bg-brand-gold text-brand-maroon-dark ring-brand-gold/30' : 'bg-slate-200 text-slate-600 ring-slate-100'
      }`}
      aria-hidden
    >
      {tone === 'valid' ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
          <circle cx={12} cy={9} r={5.5} stroke="currentColor" strokeWidth={1.7} />
          <path d="m9 13.5-1.5 6.5 4.5-2.5 4.5 2.5-1.5-6.5" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
          <path d="m9.6 9.1 1.6 1.6 3.2-3.4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
          <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
          <path d="M12 7.8v5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={12} cy={16.2} r={1} fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

export default async function VerifyCertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await lookup(token);

  return (
    <div className="bg-brand-cream/60">
      <div className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wide text-slate-900">Certificate Verification</h1>

        {result.state === 'valid' && (
          <>
            <p className="mt-2 text-slate-600">This certificate was issued by OBIAS Nursing &amp; Allied Courses Review Center.</p>

            <article className="mt-8 rounded-xl bg-white p-2 ring-1 ring-brand-gold/60">
              <div className="rounded-lg border-2 border-brand-maroon/80 p-1">
                <div className="rounded-md border border-brand-gold px-6 py-7 sm:px-8">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                          <path d="m5 10.5 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Verified record
                      </p>
                      <p className="mt-5 text-sm text-slate-600">Awarded to</p>
                      <p className="font-heading text-3xl font-bold uppercase leading-tight tracking-wide text-slate-900 [text-wrap:balance]">
                        {result.cert.studentName}
                      </p>
                      <p className="mt-3 text-sm text-slate-600">for completing</p>
                      <p className="text-lg font-semibold leading-snug text-brand-maroon [text-wrap:balance]">{result.cert.programName}</p>
                    </div>
                    <Seal tone="valid" />
                  </div>

                  <dl className="mt-7 grid gap-4 border-t border-brand-gold/60 pt-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Certificate no.</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-slate-900 [overflow-wrap:anywhere]">{result.cert.certificateNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Issued</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">
                        <time dateTime={result.cert.issuedAt}>
                          {new Date(result.cert.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>

            <p className="mt-5 text-sm leading-relaxed text-slate-600">
              Make sure the name and certificate number match the document you were given. For anything else about this
              certificate, <Link href="/contact" className="font-semibold text-brand-maroon underline underline-offset-4">contact the center</Link>.
            </p>
          </>
        )}

        {result.state !== 'valid' && (
          <div className="mt-8 flex flex-col items-start gap-5 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:p-8">
            <Seal tone="invalid" />
            <div>
              <p className="font-heading text-xl font-bold uppercase tracking-wide text-slate-900">
                {result.state === 'not-found' ? 'No matching certificate' : 'We couldn’t check this right now'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {result.state === 'not-found'
                  ? 'This link doesn’t match a certificate we issued. Check that the full link was copied, or ask the holder for a new one.'
                  : 'The verification service didn’t respond. Please try again in a few minutes.'}
              </p>
              <Link
                href="/contact"
                className="mt-4 inline-flex items-center rounded-md bg-brand-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-maroon-dark"
              >
                Contact the center
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
