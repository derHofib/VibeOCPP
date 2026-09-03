import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RollbackSettingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toVersion!: number;
}
