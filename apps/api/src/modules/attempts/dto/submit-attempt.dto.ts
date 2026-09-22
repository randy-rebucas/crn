import { Type } from 'class-transformer';
import { IsArray, IsDefined, IsString, ValidateNested } from 'class-validator';

export class AttemptAnswerInput {
  @IsString()
  questionId!: string;

  @IsDefined()
  response!: unknown;
}

export class SubmitAttemptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerInput)
  answers!: AttemptAnswerInput[];
}
