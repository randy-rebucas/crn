import { IsInt, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  @MaxLength(2000)
  reason!: string;
}
