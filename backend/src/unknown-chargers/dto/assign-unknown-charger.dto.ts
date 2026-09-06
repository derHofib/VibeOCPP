import { IsString } from 'class-validator';

export class AssignUnknownChargerDto {
  @IsString()
  stationId!: string;
}
