import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

class IdTokenDto {
  @IsString()
  idToken!: string;

  @IsString()
  type!: string;
}

export class RemoteStartDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ocppConnectionNames!: string[];

  @ValidateNested()
  @Type(() => IdTokenDto)
  idToken!: IdTokenDto;

  @IsInt()
  remoteStartId!: number;

  @IsOptional()
  @IsInt()
  evseId?: number;
}
