import { IsInt, IsPositive, IsString } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  paymentId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  reason!: string;
}
