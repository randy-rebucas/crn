import { IsOptional, IsString } from 'class-validator';

export class CreateClassDto {
  @IsString()
  batchId!: string;

  @IsString()
  courseId!: string;

  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  instructorProfileId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}
