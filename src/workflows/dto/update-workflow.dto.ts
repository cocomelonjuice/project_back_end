import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


