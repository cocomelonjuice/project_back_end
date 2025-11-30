import { IsOptional, IsUUID } from 'class-validator';

export class QueryIssuesDto {
  @IsOptional()
  @IsUUID()
  statusId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  priorityId?: string;
}





