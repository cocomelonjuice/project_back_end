import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ example: 'How do I create an issue?' })
  @IsString()
  @MinLength(1)
  @MaxLength(32000)
  content: string;
}
