import { IsOptional, IsString } from 'class-validator';

export class CreateEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  programId!: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsString()
  branchId!: string;
}
