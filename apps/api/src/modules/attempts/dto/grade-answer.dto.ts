import { IsInt, Min } from 'class-validator';

export class GradeAnswerDto {
  @IsInt()
  @Min(0)
  pointsAwarded!: number;
}
