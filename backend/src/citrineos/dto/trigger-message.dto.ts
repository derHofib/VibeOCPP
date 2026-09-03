import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class TriggerMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ocppConnectionNames!: string[];

  @IsString()
  requestedMessage!: string;

  @IsOptional()
  @IsInt()
  evseId?: number;
}
