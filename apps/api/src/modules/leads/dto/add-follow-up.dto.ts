import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddFollowUpDto {
  @IsString()
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
