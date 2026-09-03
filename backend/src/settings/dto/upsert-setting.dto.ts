import { IsIn, IsString, MinLength } from 'class-validator';
import type { SettingType } from '../settings.types.js';

const SETTING_TYPES: SettingType[] = ['string', 'number', 'boolean', 'json', 'secret'];

export class UpsertSettingDto {
  @IsIn(SETTING_TYPES)
  type!: SettingType;

  @IsString()
  @MinLength(0)
  value!: string;
}
