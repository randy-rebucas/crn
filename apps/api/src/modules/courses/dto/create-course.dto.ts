import { IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  programId!: string;

  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
