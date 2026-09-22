import { IsOptional, IsString } from 'class-validator';

export class ReviewAdmissionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
