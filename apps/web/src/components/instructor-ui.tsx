'use client';

import { adminIcons } from '@/components/admin-shell';

// Icon set for the instructor portal: the admin/student line icons plus the
// few extra glyphs the instructor views need, all 1.7px stroke on a 24 grid.
export const instructorIcons = {
  ...adminIcons,
  arrowRight: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  checkCircle: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8.3 12.3 2.5 2.5 4.9-5.3" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 7.8v5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={12} cy={16.2} r={1} fill="currentColor" />
    </svg>
  ),
  graduation: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2M21 9.5V14" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 120 24" fill="none" className="h-6 w-24" aria-hidden>
      <path d="M0 12h46l5-9 7 18 6-14 4 5h52" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
