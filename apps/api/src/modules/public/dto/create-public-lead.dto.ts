import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

// Deliberately narrower than CreateLeadDto: an anonymous website visitor
// must never be able to set branchId/assignedToId/source directly — those
// stay staff-only fields set by the backend or by registrar follow-up.
export class CreatePublicLeadDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // At least one of phone/email is required; PublicService.createLead
  // enforces that, since a conditional decorator here would also skip the
  // length check.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  programInterest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  // Honeypot: the website form hides this field from people, so a value
  // means an automated submission. Accepted (so bots see success) but never
  // stored — see PublicService.createLead.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
