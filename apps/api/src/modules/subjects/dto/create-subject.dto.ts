import { IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  courseId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
