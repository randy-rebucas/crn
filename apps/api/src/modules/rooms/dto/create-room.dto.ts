import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
