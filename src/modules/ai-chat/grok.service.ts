import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GrokChatMessage, GrokChatResponse } from './dto/grok.types';

@Injectable()
export class GrokService {
  private readonly logger = new Logger(GrokService.name);
  private readonly DEFAULT_MODEL = 'grok-4';
  private readonly DEFAULT_BASE_URL = 'https://api.x.ai/v1';
  private readonly TIMEOUT_MS = 30000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async chat(messages: GrokChatMessage[]): Promise<string> {
    const apiKey = this.configService.get<string>('XAI_API_KEY');
    if (!apiKey) {
      this.logger.error('XAI_API_KEY is not configured');
      throw new ServiceUnavailableException('AI service is not configured');
    }

    const model =
      this.configService.get<string>('XAI_MODEL') || this.DEFAULT_MODEL;
    const baseUrl =
      this.configService.get<string>('XAI_BASE_URL') || this.DEFAULT_BASE_URL;

    try {
      const response = await firstValueFrom(
        this.httpService.post<GrokChatResponse>(
          `${baseUrl}/chat/completions`,
          { model, messages, stream: false },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: this.TIMEOUT_MS,
          },
        ),
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('Grok returned no choices');
        throw new InternalServerErrorException('AI returned an empty response');
      }
      return content;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      const status = error?.response?.status;
      const body = error?.response?.data;
      this.logger.error(
        `Grok request failed (status ${status ?? 'n/a'}): ${error?.message}` +
          (body ? ` | body: ${JSON.stringify(body)}` : ''),
      );
      throw new ServiceUnavailableException(
        'The AI assistant is temporarily unavailable. Please try again.',
      );
    }
  }
}
