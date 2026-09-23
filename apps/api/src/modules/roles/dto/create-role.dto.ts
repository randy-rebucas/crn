import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { PermissionScope } from '@prisma/client';

export class RolePermissionInput {
  @IsString()
  @MaxLength(200)
  permissionKey!: string;

  @IsEnum(PermissionScope)
  scope!: PermissionScope;
}

export class CreateRoleDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, { message: 'key must be lowercase snake_case' })
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionInput)
  permissions!: RolePermissionInput[];
}
