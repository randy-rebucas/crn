import { IsBoolean, IsOptional, IsString } from 'class-validator';

// The profile fields staff edit after creation. The linked user and branch
// assignment are not changed through here.
export class UpdateInstructorDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
