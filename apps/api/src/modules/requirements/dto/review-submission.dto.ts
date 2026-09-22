import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewSubmissionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  notes?: string;
}
