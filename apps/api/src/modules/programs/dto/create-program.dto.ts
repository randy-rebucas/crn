import { IsOptional, IsString } from 'class-validator';

export class CreateProgramDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
