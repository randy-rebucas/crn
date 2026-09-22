import { EnrollmentStatus } from '@prisma/client';
import { ENROLLMENT_TRANSITIONS } from './enrollment-transitions.js';

describe('ENROLLMENT_TRANSITIONS', () => {
  it('allows the full happy path from Draft to Completed', () => {
    const path = [
      EnrollmentStatus.DRAFT,
      EnrollmentStatus.SUBMITTED,
      EnrollmentStatus.UNDER_REVIEW,
      EnrollmentStatus.APPROVED,
      EnrollmentStatus.PAYMENT_PENDING,
      EnrollmentStatus.PAYMENT_VERIFIED,
      EnrollmentStatus.ENROLLED,
      EnrollmentStatus.COMPLETED,
    ];

    for (let i = 0; i < path.length - 1; i++) {
      expect(ENROLLMENT_TRANSITIONS[path[i]]).toContain(path[i + 1]);
    }
  });

  it('rejects skipping straight to Enrolled from Draft', () => {
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.DRAFT]).not.toContain(EnrollmentStatus.ENROLLED);
  });

  it('rejects any transition out of terminal states', () => {
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.COMPLETED]).toEqual([]);
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.CANCELLED]).toEqual([]);
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.REJECTED]).toEqual([]);
  });

  it('allows cancellation from every pre-enrollment state that supports it', () => {
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.DRAFT]).toContain(EnrollmentStatus.CANCELLED);
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.SUBMITTED]).toContain(EnrollmentStatus.CANCELLED);
    expect(ENROLLMENT_TRANSITIONS[EnrollmentStatus.PAYMENT_PENDING]).toContain(
      EnrollmentStatus.CANCELLED,
    );
  });

  it('every EnrollmentStatus enum value has a transition entry', () => {
    for (const status of Object.values(EnrollmentStatus)) {
      expect(ENROLLMENT_TRANSITIONS[status]).toBeDefined();
    }
  });
});
