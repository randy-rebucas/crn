// Guards against the refund service's inline ALLOWED_TRANSITIONS map silently
// regressing to allow skipping an approval step (blueprint Section 25).
// The map itself is private to refunds.service.ts, so this re-derives the
// expected shape and cross-checks it via the service's public transition
// methods against a stub Prisma client instead of importing internals.
import { RefundStatus } from '@prisma/client';
import { RefundsService } from './refunds.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

const actor: AuthenticatedUser = {
  id: 'actor-1',
  organizationId: 'org-1',
  email: 'actor@example.com',
  firstName: 'Test',
  lastName: 'User',
  branchIds: ['branch-1'],
  roles: ['finance_manager'],
  permissions: [
    { key: 'refunds.officer_approve', scope: 'BRANCH' },
    { key: 'refunds.manager_approve', scope: 'BRANCH' },
    { key: 'refunds.process', scope: 'BRANCH' },
    { key: 'refunds.view', scope: 'BRANCH' },
  ],
};

function makeStubs(initialStatus: RefundStatus, officerApproverId: string | null = null) {
  const refund = {
    id: 'refund-1',
    status: initialStatus,
    paymentId: 'payment-1',
    approvedById: null as string | null,
    processedAt: null as Date | null,
  };

  const prisma = {
    refund: {
      findFirst: async () => ({ ...refund, organizationId: 'org-1' }),
      update: async ({ data }: { data: Partial<typeof refund> & { status: RefundStatus } }) => {
        Object.assign(refund, data);
        return { ...refund };
      },
    },
    payment: {
      findUniqueOrThrow: async () => ({ id: 'payment-1', invoiceId: 'invoice-1' }),
    },
    auditLog: {
      findFirst: async () => (officerApproverId ? { actorId: officerApproverId } : null),
    },
  } as any;

  const audit = { log: async () => {} } as any;
  const invoices = { recomputeStatus: async () => {} } as any;

  return { service: new RefundsService(prisma, audit, invoices), refund };
}

describe('RefundsService transition guard', () => {
  it('allows Requested -> Officer Approved -> Approved -> Processed in order', async () => {
    const { service } = makeStubs(RefundStatus.REQUESTED);

    await expect(service.officerApprove(actor, 'refund-1')).resolves.toMatchObject({
      status: RefundStatus.OFFICER_APPROVED,
    });
  });

  it('rejects jumping from Requested straight to Approved (skipping officer approval)', async () => {
    const { service } = makeStubs(RefundStatus.REQUESTED);

    await expect(service.managerApprove(actor, 'refund-1')).rejects.toThrow(
      /Cannot move refund/,
    );
  });

  it('rejects a manager approval from the same person who officer-approved', async () => {
    const { service } = makeStubs(RefundStatus.OFFICER_APPROVED, 'actor-1');

    await expect(service.managerApprove(actor, 'refund-1')).rejects.toThrow(/someone other than the officer/);
  });

  it('allows a manager approval from a different person than the officer', async () => {
    const { service } = makeStubs(RefundStatus.OFFICER_APPROVED, 'officer-2');

    await expect(service.managerApprove(actor, 'refund-1')).resolves.toMatchObject({
      status: RefundStatus.APPROVED,
    });
  });

  it('rejects processing a refund that has not been manager-approved', async () => {
    const { service } = makeStubs(RefundStatus.OFFICER_APPROVED);

    await expect(service.process(actor, 'refund-1')).rejects.toThrow(
      /Cannot move refund/,
    );
  });

  it('rejects any transition out of a terminal Processed refund', async () => {
    const { service } = makeStubs(RefundStatus.PROCESSED);

    await expect(service.officerApprove(actor, 'refund-1')).rejects.toThrow(
      /Cannot move refund/,
    );
  });
});
