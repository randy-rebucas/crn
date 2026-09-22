import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateScheduleDto {
  @IsString()
  classId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number; // 0 = Sunday .. 6 = Saturday

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:MM 24h format' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:MM 24h format' })
  endTime!: string;
}
