import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  position!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;
}
