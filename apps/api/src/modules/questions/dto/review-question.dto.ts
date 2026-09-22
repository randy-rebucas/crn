import { ContentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ReviewQuestionDto {
  @IsEnum(ContentStatus)
  status!: ContentStatus;
}
