import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StaffStatus } from '@prisma/client';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;
}
