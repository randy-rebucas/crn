import { IsBoolean, IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';
import { CLASS_REMINDER_OPTIONS } from '../student-preferences.js';

// Partial update of the caller's own StudentPreferences. Omitted fields keep
// their stored value; the two reminder fields accept `null` to turn the
// reminder off (same convention as UpdateMyStudentDto).
export class UpdateMyPreferencesDto {
  @IsOptional()
  @IsBoolean()
  notifySchedule?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyExams?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyPayments?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyCertificates?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsIn(CLASS_REMINDER_OPTIONS)
  classReminderMinutes?: number | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'studyReminderTime must be HH:MM (24-hour)' })
  studyReminderTime?: string | null;

  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSuccessStory?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}
