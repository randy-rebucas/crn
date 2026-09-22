import { MaterialType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  lessonId!: string;

  @IsString()
  title!: string;

  @IsEnum(MaterialType)
  type!: MaterialType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsInt()
  position?: number;
}
