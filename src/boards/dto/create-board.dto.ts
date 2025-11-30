import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  type: string; // 'kanban' or 'scrum'
}


