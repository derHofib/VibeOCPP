import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class RemoteStopDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ocppConnectionNames!: string[];

  @IsString()
  transactionId!: string;
}
