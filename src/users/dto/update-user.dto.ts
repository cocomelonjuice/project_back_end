import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  username?: string;

  @IsOptional()
  @IsEmail()
  @Length(5, 100)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
