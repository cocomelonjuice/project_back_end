import { IsInt, IsPositive, IsString, Length } from 'class-validator';

export class CreatePriorityDto {
  @IsString()
  @Length(3, 50)
  name: string;

  @IsInt()
  @IsPositive()
  orderNum: number;
}





