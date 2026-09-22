import { IsOptional, IsString } from 'class-validator';

export class AddFollowUpDto {
  @IsString()
  note!: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}
