import { IsString } from 'class-validator';

export class IssueCertificateDto {
  @IsString()
  studentId!: string;

  @IsString()
  programId!: string;
}
