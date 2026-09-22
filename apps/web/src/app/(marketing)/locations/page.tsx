import type { Metadata } from 'next';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Our Branches',
  description: 'Find an OBIAS Nursing & Allied Courses Review Center branch near you.',
};

interface PublicBranch {
  id: string;
  name: string;
  code: string;
  address: string | null;
}

async function getActiveBranches(): Promise<PublicBranch[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/branches`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function BranchesPage() {
  const branches = await getActiveBranches();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Our Branches</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Visit us at any of our locations to learn more or enroll in person.</p>

      {branches.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Branch information is being updated — please contact us directly.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {branches.map((branch) => (
            <div key={branch.id} className="rounded-xl border border-slate-200 bg-brand-cream p-6">
              <h2 className="font-heading font-semibold text-slate-900">{branch.name}</h2>
              {branch.address && <p className="mt-2 text-sm text-slate-600">{branch.address}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-xl bg-brand-gold/20 p-8 text-center">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Have questions about a branch?</h2>
        <Link
          href="/contact"
          className="mt-4 inline-block rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
