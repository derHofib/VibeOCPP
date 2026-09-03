import { ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';

const RESET_TYPES = ['Immediate', 'OnIdle', 'ImmediateAndResume'] as const;

export class ResetDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ocppConnectionNames!: string[];

  @IsIn(RESET_TYPES)
  type!: (typeof RESET_TYPES)[number];
}
