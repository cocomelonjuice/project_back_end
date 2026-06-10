import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  @Length(2, 20)
  key?: string;

  @IsString()
  @Length(3, 100)
  name: string;

  @IsString()
  @Length(3, 20)
  type: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
