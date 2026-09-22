import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsPositive, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  invoiceId!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
