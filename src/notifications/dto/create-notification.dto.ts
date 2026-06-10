import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @Length(1, 255)
  title: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsString()
  @Length(1, 50)
  type: string;

  @IsOptional()
  @IsUUID()
  issueId?: string;
}
