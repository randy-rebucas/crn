import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  moduleId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  position?: number;
}
