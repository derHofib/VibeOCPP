import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsInt() operatorId?: number;
}

export class UpdateLocationDto {
  @IsOptional() @IsString() @MinLength(1) locationId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsInt() operatorId?: number;
}
