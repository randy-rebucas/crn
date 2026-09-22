import { EnrollmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class TransitionEnrollmentDto {
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;
}
