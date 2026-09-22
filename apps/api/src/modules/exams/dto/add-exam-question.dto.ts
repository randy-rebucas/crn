import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class AddExamQuestionDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  points?: number;

  @IsOptional()
  @IsInt()
  position?: number;
}
