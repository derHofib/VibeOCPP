import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEvseDto {
  @IsString() @MinLength(1) evseId!: string;
  @IsInt() ocppEvseId!: number;
  @IsString() @MinLength(1) status!: string;
  @IsString() @MinLength(1) stationId!: string;
  @IsString() @MinLength(1) tenantId!: string;
  @IsOptional() @IsInt() locationId?: number;
}

export class UpdateEvseDto {
  @IsOptional() @IsString() @MinLength(1) evseId?: string;
  @IsOptional() @IsInt() ocppEvseId?: number;
  @IsOptional() @IsString() @MinLength(1) status?: string;
  @IsOptional() @IsString() @MinLength(1) stationId?: string;
  @IsOptional() @IsString() @MinLength(1) tenantId?: string;
  @IsOptional() @IsInt() locationId?: number;
}
