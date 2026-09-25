import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { StaffStatus } from '@prisma/client';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  position?: string;

  // `null` clears it; omitted leaves it unchanged.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  department?: string | null;

  // `null` unassigns the person from any branch.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;
}
