import { IsIn, IsInt, IsOptional, Min, MinLength } from 'class-validator';

export class CreateConnectorDto {
  @MinLength(1)
  label!: string;

  @IsInt()
  @Min(1)
  evseId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  connectorId?: number;

  @MinLength(1)
  type!: string;

  @IsIn(['Socket', 'Cable'])
  format!: 'Socket' | 'Cable';
}
