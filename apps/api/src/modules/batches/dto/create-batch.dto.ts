import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  programId!: string;

  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
