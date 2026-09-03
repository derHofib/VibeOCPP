import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateConnectorDto {
  @IsString() @MinLength(1) connectorId!: string;
  @IsString() @MinLength(1) powerType!: string;
  @IsInt() maxVoltage!: number;
  @IsInt() maxAmperage!: number;
  @IsOptional() @IsInt() evseId?: number;
  @IsOptional() @IsInt() tariffId?: number;
}

export class UpdateConnectorDto {
  @IsOptional() @IsString() @MinLength(1) connectorId?: string;
  @IsOptional() @IsString() @MinLength(1) powerType?: string;
  @IsOptional() @IsInt() maxVoltage?: number;
  @IsOptional() @IsInt() maxAmperage?: number;
  @IsOptional() @IsInt() evseId?: number;
  @IsOptional() @IsInt() tariffId?: number;
}
