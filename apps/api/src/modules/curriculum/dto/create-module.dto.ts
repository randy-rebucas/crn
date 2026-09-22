import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  subjectId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  position?: number;
}
