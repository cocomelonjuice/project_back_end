import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConversationDto {
  @ApiPropertyOptional({ maxLength: 200, description: 'Empty clears to default untitled' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
