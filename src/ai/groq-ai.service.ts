import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class GroqAiService {
  constructor(private readonly configService: ConfigService) {}

  async complete(messages: ChatCompletionMessage[]): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI provider is not configured (missing GROQ_API_KEY)',
      );
    }

    const model = this.configService.get<string>(
      'GROQ_MODEL',
      'openai/gpt-oss-120b',
    );
    const url =
      this.configService.get<string>('GROQ_API_URL') ??
      'https://api.groq.com/openai/v1/chat/completions';

    try {
      const { data } = await axios.post<{
        choices?: Array<{ message?: { content?: string } }>;
      }>(
        url,
        {
          model,
          messages,
          temperature: 0.7,
          max_completion_tokens: 4096,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 120_000,
        },
      );

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new InternalServerErrorException('Empty or invalid AI response');
      }
      return content.trim();
    } catch (err: unknown) {
      if (
        err instanceof ServiceUnavailableException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      if (axios.isAxiosError(err)) {
        const msg =
          (err.response?.data as { error?: { message?: string } })?.error
            ?.message ?? err.message;
        throw new InternalServerErrorException(
          `Groq request failed: ${msg}`,
        );
      }
      throw new InternalServerErrorException('Groq request failed');
    }
  }
}
