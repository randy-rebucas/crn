import type { OrganizationSettings, PrismaClient } from '@prisma/client';

// Read-only access for modules that act on a setting (payments, invoices,
// certificates, ...) without depending on SettingsModule. The settings row
// is created lazily, so an organization that never opened the Settings
// screen gets the same values the schema defaults would give it.
export const SETTINGS_DEFAULTS: Omit<OrganizationSettings, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'updatedById'> = {
  supportEmail: null,
  supportPhone: null,
  timezone: 'Asia/Manila',
  allowSelfEnrollment: false,
  notifyOnEnrollment: true,
  notifyOnPaymentVerified: true,
  notifyOnCertificateIssued: true,
  address: null,
  additionalPhones: [],
  facebookPageName: null,
  facebookUrl: null,
  enrollmentOpen: true,
  enrollmentNotice: 'Now Accepting Enrollees!',
  defaultCurrency: 'PHP',
  invoiceDueDays: null,
  receiptPrefix: 'RCPT',
  certificatePrefix: 'CERT',
};

export type EffectiveSettings = typeof SETTINGS_DEFAULTS;

type SettingsReader = Pick<PrismaClient, 'organizationSettings'>;

export async function readOrgSettings(prisma: SettingsReader, organizationId: string): Promise<EffectiveSettings> {
  const row = await prisma.organizationSettings.findUnique({ where: { organizationId } });
  return row ?? SETTINGS_DEFAULTS;
}
