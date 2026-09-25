import type { PrismaClient, StudentPreferences } from '@prisma/client';

// Read-only access for modules that act on a student's preferences
// (notifications today; reminder/digest senders later) without depending on
// StudentsModule. The row is created lazily, so a student who never saved
// Settings gets the same values the schema defaults would give them.
export const STUDENT_PREFERENCE_DEFAULTS: Omit<
  StudentPreferences,
  'id' | 'studentProfileId' | 'organizationId' | 'createdAt' | 'updatedAt'
> = {
  notifySchedule: true,
  notifyExams: true,
  notifyAnnouncements: true,
  notifyPayments: true,
  notifyCertificates: true,
  emailEnabled: true,
  smsEnabled: false,
  classReminderMinutes: 60,
  studyReminderTime: null,
  weeklyDigest: true,
  allowSuccessStory: false,
  marketingOptIn: false,
};

export type EffectiveStudentPreferences = typeof STUDENT_PREFERENCE_DEFAULTS;

// Offered in the UI; the DTO rejects anything else so a reminder worker
// never has to cope with arbitrary lead times.
export const CLASS_REMINDER_OPTIONS = [15, 30, 60, 180, 1440] as const;

type NotificationToggle = 'notifySchedule' | 'notifyExams' | 'notifyAnnouncements' | 'notifyPayments' | 'notifyCertificates';

// Maps a Notification.type ("payment.verified") to the toggle that can mute
// it. Anything unmapped (enrollment, admission, requirement, account) is
// always delivered — a student shouldn't be able to miss that their
// enrollment was rejected.
export function notificationToggle(type: string): NotificationToggle | null {
  const prefix = type.split('.')[0];
  switch (prefix) {
    case 'schedule':
    case 'class':
    case 'attendance':
      return 'notifySchedule';
    case 'exam':
    case 'attempt':
    case 'grade':
      return 'notifyExams';
    case 'announcement':
      return 'notifyAnnouncements';
    case 'payment':
    case 'invoice':
    case 'refund':
      return 'notifyPayments';
    case 'certificate':
      return 'notifyCertificates';
    default:
      return null;
  }
}

type PreferencesReader = Pick<PrismaClient, 'studentPreferences'>;

export async function readStudentPreferencesByUser(
  prisma: PreferencesReader,
  userId: string,
): Promise<EffectiveStudentPreferences | null> {
  const row = await prisma.studentPreferences.findFirst({ where: { studentProfile: { userId } } });
  return row ?? null;
}
