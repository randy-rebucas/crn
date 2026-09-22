import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateSuccessStoryDto {
  @IsString()
  graduateName!: string;

  @IsString()
  programName!: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsString()
  testimonial!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
