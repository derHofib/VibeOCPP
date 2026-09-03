import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class IdTokenDto {
  @IsString()
  idToken!: string;

  @IsString()
  type!: string;
}

// Operator-supplied inputs for the 'command' steps that need them — see
// testsuite-run-params.ts. Everything here is optional: an unset field just
// means that one step gets skipped, not that the whole run is rejected.
class RunParamsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => IdTokenDto)
  idToken?: IdTokenDto;

  @IsOptional()
  @IsInt()
  remoteStartId?: number;

  @IsOptional()
  @IsInt()
  evseId?: number;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsIn(['Immediate', 'OnIdle', 'ImmediateAndResume'])
  resetType?: 'Immediate' | 'OnIdle' | 'ImmediateAndResume';

  @IsOptional()
  @IsString()
  componentName?: string;

  @IsOptional()
  @IsString()
  variableName?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;
}

export class StartRunDto {
  @IsString()
  ocppConnectionName!: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @IsString()
  ocppVersion!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RunParamsDto)
  params?: RunParamsDto;

  // Shortens (never lengthens) every step's wait below its catalog
  // default — for a fast sanity check rather than a full diagnostic pass.
  @IsOptional()
  @IsInt()
  maxTimeoutMs?: number;
}
