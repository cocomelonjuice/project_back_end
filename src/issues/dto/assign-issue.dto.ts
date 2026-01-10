import { IsUUID, IsOptional, ValidateIf } from 'class-validator';

export class AssignIssueDto {
  @IsOptional()
  @ValidateIf((o) => o.assigneeId !== null)
  @IsUUID()
  assigneeId?: string | null;
}





