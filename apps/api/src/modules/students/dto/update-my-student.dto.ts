import { IsString, MaxLength, ValidateIf } from 'class-validator';

// What a student may change about themselves. Name, email, date of birth
// and branch stay registrar-owned (they appear on certificates and
// enrollment records), so they're deliberately absent here.
//
// Nullable text fields accept `null` to clear them; `undefined` leaves the
// stored value alone (same convention as UpdateSettingsDto).
export class UpdateMyStudentDto {
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string | null;
}
