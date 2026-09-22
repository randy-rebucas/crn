import { EnrollmentStatus } from '@prisma/client';

// Enrollment status machine (see blueprint Section 11: Enrollment workflow).
export const ENROLLMENT_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  DRAFT: [EnrollmentStatus.SUBMITTED, EnrollmentStatus.CANCELLED],
  SUBMITTED: [EnrollmentStatus.UNDER_REVIEW, EnrollmentStatus.CANCELLED],
  UNDER_REVIEW: [
    EnrollmentStatus.REQUIREMENTS_INCOMPLETE,
    EnrollmentStatus.APPROVED,
    EnrollmentStatus.REJECTED,
  ],
  REQUIREMENTS_INCOMPLETE: [EnrollmentStatus.UNDER_REVIEW, EnrollmentStatus.CANCELLED],
  APPROVED: [EnrollmentStatus.PAYMENT_PENDING],
  PAYMENT_PENDING: [EnrollmentStatus.PAYMENT_VERIFIED, EnrollmentStatus.CANCELLED],
  PAYMENT_VERIFIED: [EnrollmentStatus.ENROLLED],
  ENROLLED: [EnrollmentStatus.COMPLETED, EnrollmentStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};
