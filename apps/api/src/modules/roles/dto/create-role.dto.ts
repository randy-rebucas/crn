import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PermissionScope } from '@prisma/client';

export class RolePermissionInput {
  @IsString()
  permissionKey!: string;

  @IsEnum(PermissionScope)
  scope!: PermissionScope;
}

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionInput)
  permissions!: RolePermissionInput[];
}
