import { Difficulty, QuestionType } from '@prisma/client';
import { IsArray, IsDefined, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  subjectId!: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsString()
  content!: string;

  @IsOptional()
  options?: { id: string; text: string }[];

  @IsDefined()
  correctAnswer!: unknown;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
