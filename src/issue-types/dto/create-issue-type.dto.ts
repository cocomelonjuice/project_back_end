import { IsOptional, IsString, Length } from 'class-validator';

export class CreateIssueTypeDto {
  @IsString()
  @Length(3, 50)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
