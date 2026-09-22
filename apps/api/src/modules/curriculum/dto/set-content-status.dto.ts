import { ContentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetContentStatusDto {
  @IsEnum(ContentStatus)
  status!: ContentStatus;
}
