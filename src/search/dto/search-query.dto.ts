import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q: string;

  @IsOptional()
  @IsString()
  type?: 'all' | 'projects' | 'issues' | 'users';

  @IsOptional()
  limit?: number;
}




