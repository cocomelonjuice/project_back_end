import { IsString, Length } from 'class-validator';

export class CreateStatusDto {
  @IsString()
  @Length(3, 50)
  name: string;

  @IsString()
  @Length(2, 20)
  category: string;
}
