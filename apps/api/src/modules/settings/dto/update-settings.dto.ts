import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  supportPhone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  allowSelfEnrollment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnEnrollment?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnPaymentVerified?: boolean;
}
