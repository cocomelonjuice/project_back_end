import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(64, 64)
  @Matches(/^[a-f0-9]+$/i, { message: 'token must be a hex string' })
  token: string;

  @IsString()
  @Length(8, 100)
  newPassword: string;
}
