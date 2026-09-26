import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { listSchedule, type BatchStatus } from '@/lib/public-api';

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Upcoming and ongoing review batches at OBIAS Nursing & Allied Courses Review Center.',
};

const STATUS: Record<BatchStatus, { label: string; tone: string }> = {
  UPCOMING: { label: 'Upcoming', tone: 'border-amber-200 bg-amber-100 text-amber-800' },
  ACTIVE: { label: 'Ongoing', tone: 'border-emerald-200 bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Completed', tone: 'border-slate-200 bg-slate-100 text-slate-700' },
  CANCELLED: { label: 'Cancelled', tone: 'border-red-200 bg-red-50 text-red-700' },
};

export default async function SchedulePage() {
  const batches = await listSchedule();
  // The center runs from one location; a Branch column only earns its place
  // if batches are actually spread across more than one.
  const showBranch = new Set(batches.map((b) => b.branch.id)).size > 1;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Schedule</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Upcoming and ongoing review batches.</p>

      {batches.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No upcoming batches are posted yet — please contact us for the latest schedule.</p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Program</th>
                  {showBranch && <th className="px-4 py-3">Branch</th>}
                  <th className="px-4 py-3">Starts</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {batches.map((batch) => {
                  const status = STATUS[batch.status] ?? STATUS.UPCOMING;
                  return (
                    <tr key={batch.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{batch.name}</td>
                      <td className="px-4 py-3 text-slate-600">{batch.program.name}</td>
                      {showBranch && <td className="px-4 py-3 text-slate-600">{batch.branch.name}</td>}
                      <td className="px-4 py-3 text-slate-600">
                        <time dateTime={batch.startDate}>{formatDate(batch.startDate)}</time>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.tone}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
