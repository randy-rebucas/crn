import { AttendanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsString } from 'class-validator';

export class MarkAttendanceDto {
  @IsString()
  studentId!: string;

  @IsString()
  classId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
