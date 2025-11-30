import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  @Length(1, 50)
  action: string;

  @IsString()
  @Length(1, 50)
  entityType: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  oldValues?: Record<string, any>;

  @IsOptional()
  newValues?: Record<string, any>;

  @IsOptional()
  @IsString()
  description?: string;
}


