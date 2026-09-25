import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Nullable text fields accept `null` to clear them; `undefined` leaves the
// stored value alone. Required-with-default fields (currency, prefixes)
// can be changed but never cleared.
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationName?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsEmail()
  supportEmail?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(40)
  supportPhone?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  additionalPhones?: string[];

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(120)
  facebookPageName?: string | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsUrl({ require_protocol: true })
  facebookUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enrollmentOpen?: boolean;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(80)
  enrollmentNotice?: string | null;

  @IsOptional()
  @IsBoolean()
  allowSelfEnrollment?: boolean;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'defaultCurrency must be a 3-letter ISO code like PHP' })
  defaultCurrency?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  @Min(0)
  @Max(365)
  invoiceDueDays?: number | null;

  @IsOptional()
  @Matches(/^[A-Z0-9]{1,10}$/, { message: 'receiptPrefix must be 1–10 uppercase letters or digits' })
  receiptPrefix?: string;

  @IsOptional()
  @Matches(/^[A-Z0-9]{1,10}$/, { message: 'certificatePrefix must be 1–10 uppercase letters or digits' })
  certificatePrefix?: string;

  @IsOptional()
  @IsBoolean()
  notifyOnEnrollment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnPaymentVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnCertificateIssued?: boolean;
}
