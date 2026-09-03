import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOperatorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  stripeAccountId!: string;
}

export class UpdateOperatorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  stripeAccountId?: string;
}
