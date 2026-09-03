import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class IncomingWebhookEventDto {
  @IsString()
  ocppConnectionName!: string;

  @IsIn(['connected', 'closed', 'message'])
  event!: 'connected' | 'closed' | 'message';

  @IsOptional()
  @IsIn(['ChargingStation', 'ChargingStationManagementSystem'])
  origin?: 'ChargingStation' | 'ChargingStationManagementSystem';

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  info?: Record<string, string>;
}
