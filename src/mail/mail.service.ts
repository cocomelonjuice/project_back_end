import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
    this.from = this.configService.get<string>(
      'MAIL_FROM',
      'onboarding@resend.dev',
    );
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY is not set; transactional emails will be skipped.',
      );
    }
  }

  async sendTransactional(params: SendMailParams): Promise<void> {
    if (!this.resend) {
      this.logger.debug(
        `Skip email (no Resend): to=${params.to} subject=${params.subject}`,
      );
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      if (error) {
        this.logger.warn(`Resend error: ${JSON.stringify(error)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to send email: ${msg}`);
    }
  }

  getFrontendBaseUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173'
    );
  }
}
