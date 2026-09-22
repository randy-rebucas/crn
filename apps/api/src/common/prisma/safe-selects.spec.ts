import { SAFE_USER_SELECT } from './safe-selects.js';

// This shape got widened to leak passwordHash into API responses twice in
// one session (Classes/Enrollments/Attendance all did `include: { user: true }`).
// Locking down the allowed keys here means a future edit that adds a
// sensitive column back in fails a test instead of shipping.
describe('SAFE_USER_SELECT', () => {
  const SENSITIVE_FIELDS = ['passwordHash', 'mfaSecret'];

  it('never selects passwordHash or mfaSecret', () => {
    for (const field of SENSITIVE_FIELDS) {
      expect(Object.keys(SAFE_USER_SELECT)).not.toContain(field);
    }
  });

  it('only selects fields safe to expose in a nested API response', () => {
    expect(Object.keys(SAFE_USER_SELECT).sort()).toEqual(
      ['email', 'firstName', 'id', 'lastName', 'phone', 'status'].sort(),
    );
  });
});
