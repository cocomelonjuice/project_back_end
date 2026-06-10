import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class SpacesService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('SPACES_ENDPOINT')?.trim();
    const region = this.configService.get<string>('SPACES_REGION', 'sgp1');
    const accessKeyId = this.configService
      .get<string>('SPACES_ACCESS_KEY_ID')
      ?.trim();
    const secretAccessKey = this.configService
      .get<string>('SPACES_SECRET_ACCESS_KEY')
      ?.trim();
    this.bucket = this.configService.get<string>('SPACES_BUCKET', '').trim();

    this.enabled = Boolean(
      endpoint && accessKeyId && secretAccessKey && this.bucket,
    );

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: false,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getBucket(): string {
    return this.bucket;
  }

  async uploadObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    this.ensureEnabled();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.ensureEnabled();
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 600,
  ): Promise<string> {
    this.ensureEnabled();
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new InternalServerErrorException(
        'Spaces storage is not configured. Set SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_ACCESS_KEY_ID, and SPACES_SECRET_ACCESS_KEY.',
      );
    }
  }
}
