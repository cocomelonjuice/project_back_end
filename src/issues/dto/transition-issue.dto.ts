import { IsUUID } from 'class-validator';

export class TransitionIssueDto {
  @IsUUID()
  statusId: string;
}





