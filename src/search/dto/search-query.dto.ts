import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

const toStringArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const normalized = raw
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
};

export class SearchQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  })
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  type?: 'all' | 'projects' | 'issues' | 'users';

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  projectKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  projectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issueStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuePriority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignee?: string;

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  projectKeys?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  projectTypes?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  issueStatusIds?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  issuePriorityIds?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  issueKeys?: string[];
}
