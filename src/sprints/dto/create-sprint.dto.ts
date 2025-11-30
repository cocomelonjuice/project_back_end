import { IsOptional, IsString, Length } from 'class-validator';

export class CreateSprintDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;

  @IsOptional()
  @IsString()
  @Length(3, 20)
  status?: string; // 'planned', 'active', 'closed'
}


