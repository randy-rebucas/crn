import type { IconName } from '../icons';

// Non-board courses the center offers (PRODUCT.md). They aren't modelled as
// programs in the API, so the site lists them from here.
export const ADDITIONAL_OFFERINGS: { name: string; blurb: string; icon: IconName }[] = [
  { name: 'Seminar & Training', blurb: 'Skills development and continuing education.', icon: 'presentation' },
  { name: 'Caregiving Course', blurb: 'Become a globally competitive caregiver.', icon: 'people' },
  { name: 'Foreign Language Skills', blurb: 'Learn languages for international opportunities.', icon: 'chat' },
];

// Board review programs, used only when the API has no published programs to
// offer (e.g. it is unreachable) so the enrollment form never has an empty list.
export const FALLBACK_REVIEW_PROGRAMS = ['Nursing (NLE)', 'Midwifery', 'Medical Technology', 'Physical Therapy'];
