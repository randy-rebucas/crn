import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  // The caller's own refresh token, so this session survives while every
  // other one is signed out. Omitted = sign out everywhere, including here.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
