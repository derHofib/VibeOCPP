import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTariffDto {
  @IsOptional() @IsNumber() priceKwh?: number;
  @IsOptional() @IsNumber() priceMinute?: number;
  @IsOptional() @IsNumber() priceSession?: number;
  @IsString() @MinLength(1) currency!: string;
  @IsNumber() taxRate!: number;
  @IsNumber() authorizationAmount!: number;
  @IsNumber() paymentFee!: number;
  @IsOptional() @IsString() stripePriceId?: string;
}

export class UpdateTariffDto {
  @IsOptional() @IsNumber() priceKwh?: number;
  @IsOptional() @IsNumber() priceMinute?: number;
  @IsOptional() @IsNumber() priceSession?: number;
  @IsOptional() @IsString() @MinLength(1) currency?: string;
  @IsOptional() @IsNumber() taxRate?: number;
  @IsOptional() @IsNumber() authorizationAmount?: number;
  @IsOptional() @IsNumber() paymentFee?: number;
  @IsOptional() @IsString() stripePriceId?: string;
}
