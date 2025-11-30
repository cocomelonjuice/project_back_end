import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateLabelDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;
}


