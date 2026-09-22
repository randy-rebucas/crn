import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreatePricingDto {
  @IsString()
  programId!: string;

  @IsInt()
  @IsPositive()
  amount!: number; // smallest currency unit (e.g. centavos)

  @IsOptional()
  @IsString()
  currency?: string;
}
