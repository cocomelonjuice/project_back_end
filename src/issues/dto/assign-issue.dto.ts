import { IsUUID } from 'class-validator';

export class AssignIssueDto {
  @IsUUID()
  assigneeId: string;
}





