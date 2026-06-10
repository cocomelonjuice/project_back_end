import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(3, 50)
  username: string;

  @IsEmail()
  @Length(5, 100)
  email: string;

  @IsString()
  @Length(3, 100)
  displayName: string;

  @IsString()
  @Length(8, 100)
  password: string;
}
