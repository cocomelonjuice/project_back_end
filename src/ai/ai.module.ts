import { Module } from '@nestjs/common';
import { GroqAiService } from './groq-ai.service';

@Module({
  providers: [GroqAiService],
  exports: [GroqAiService],
})
export class AiModule {}
