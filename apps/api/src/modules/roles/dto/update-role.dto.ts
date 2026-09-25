import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { RolePermissionInput } from './create-role.dto.js';

// The key is the role's stable identifier (referenced by seed/data), so it
// can't be changed after creation — only its label, description and grants.
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  // `null` clears the description.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  // When present, replaces the role's full permission set.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionInput)
  permissions?: RolePermissionInput[];
}
