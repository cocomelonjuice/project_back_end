import { IsOptional, IsString, IsArray, Length } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
