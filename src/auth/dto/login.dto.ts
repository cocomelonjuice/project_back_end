import { IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // username or email

  @IsString()
  @Length(8, 100)
  password: string;
}
