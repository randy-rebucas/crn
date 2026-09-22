import { IsOptional, IsString } from 'class-validator';

export class CreateAdmissionDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
