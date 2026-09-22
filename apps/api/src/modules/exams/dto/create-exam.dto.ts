import { ExamType, ResultRelease } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateExamDto {
  @IsString()
  title!: string;

  @IsEnum(ExamType)
  type!: ExamType;

  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  timeLimitMinutes?: number;

  @IsInt()
  @Min(0)
  passingScore!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  attemptLimit?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsOptional()
  @IsEnum(ResultRelease)
  resultRelease?: ResultRelease;
}
