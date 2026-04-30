import { IsString, IsBoolean, IsUUID, Length, IsOptional } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


