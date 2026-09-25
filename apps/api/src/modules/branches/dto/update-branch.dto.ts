import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// The code stays fixed once created: it's the branch's unique short label
// used on classes, rooms and reports.
export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  // `null` clears the address.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  // Inactive branches drop off the public site's locations list.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
