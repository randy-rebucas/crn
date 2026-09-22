import { IsString } from 'class-validator';

export class StartAttemptDto {
  @IsString()
  examId!: string;
}
