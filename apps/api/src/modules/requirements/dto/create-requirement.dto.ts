import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateRequirementDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // null/omitted = applies to every program.
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
