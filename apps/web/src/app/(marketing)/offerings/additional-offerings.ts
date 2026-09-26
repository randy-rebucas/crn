// Non-board courses the center offers (PRODUCT.md). They aren't modelled as
// programs in the API, so the site lists them from here.
export const ADDITIONAL_OFFERINGS = [
  { name: 'Seminar & Training', blurb: 'Short-form seminars and training sessions for healthcare professionals.' },
  { name: 'Caregiving Course', blurb: 'Skills training for aspiring caregivers.' },
  { name: 'Foreign Language Skills', blurb: 'Language preparation for healthcare professionals working abroad.' },
];

// Board review programs, used only when the API has no published programs to
// offer (e.g. it is unreachable) so the enrollment form never has an empty list.
export const FALLBACK_REVIEW_PROGRAMS = ['Nursing (NLE)', 'Midwifery', 'Medical Technology', 'Physical Therapy'];
