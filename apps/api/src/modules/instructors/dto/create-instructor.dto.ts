import { IsOptional, IsString } from 'class-validator';

export class CreateInstructorDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;
}
