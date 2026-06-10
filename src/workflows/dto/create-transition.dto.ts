import { IsUUID } from 'class-validator';

export class CreateTransitionDto {
  @IsUUID()
  fromStatusId: string;

  @IsUUID()
  toStatusId: string;
}
