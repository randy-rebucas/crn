import type { Metadata } from 'next';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Upcoming and ongoing review batches at OBIAS Nursing & Allied Courses Review Center.',
};

interface PublicBatch {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  program: { id: string; name: string };
  branch: { id: string; name: string };
}

async function getSchedule(): Promise<PublicBatch[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/schedule`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function SchedulePage() {
  const batches = await getSchedule();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Schedule</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Upcoming and ongoing review batches across our branches.</p>

      {batches.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No upcoming batches are posted yet — please contact us for the latest schedule.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Starts</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{batch.name}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.program.name}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.branch.name}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(batch.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        batch.status === 'ACTIVE'
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                          : 'border-amber-200 bg-amber-100 text-amber-800'
                      }`}
                    >
                      {batch.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-12 rounded-xl bg-brand-gold/20 p-8 text-center">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Ready to join a batch?</h2>
        <Link
          href="/contact"
          className="mt-4 inline-block rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Enroll / Apply Now
        </Link>
      </div>
    </div>
  );
}
