import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// The identity a real/simulated charge point must present when it connects
// (the last segment of its OCPP-J WebSocket URL) — kept restrictive
// (alphanumeric, dash, underscore) since it becomes part of that URL.
const CHARGEBOX_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class CreateStationDto {
  @Matches(CHARGEBOX_ID_PATTERN, {
    message: 'chargeboxId may only contain letters, digits, "-" and "_"',
  })
  chargeboxId!: string;

  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsIn(['1.6', '2.0.1', '2.1'])
  ocppVersion?: string;
}
