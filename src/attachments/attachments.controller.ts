import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Attachments')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AttachmentsController {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  private static readonly ALLOWED_MIME_TYPES = new Set<string>([
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('issues/:issueId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AttachmentsController.MAX_FILE_SIZE, files: 1 },
    }),
  )
  @ApiOperation({ summary: 'Upload an attachment to an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Attachment successfully uploaded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  async upload(
    @Param('issueId') issueId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (file.size > AttachmentsController.MAX_FILE_SIZE) {
      throw new BadRequestException('File too large. Maximum size is 10 MB');
    }
    if (!AttachmentsController.ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: jpg, png, pdf, doc, docx, xls, xlsx',
      );
    }

    return await this.attachmentsService.create(issueId, req.user.id, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });
  }

  @Get('issues/:issueId/attachments')
  @ApiOperation({ summary: 'Get all attachments for an issue' })
  @ApiParam({ name: 'issueId', description: 'Issue UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of attachments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  findByIssue(@Param('issueId') issueId: string) {
    return this.attachmentsService.findByIssue(issueId);
  }

  @Get('attachments/:id')
  @ApiOperation({ summary: 'Get attachment metadata by ID' })
  @ApiParam({ name: 'id', description: 'Attachment UUID' })
  @ApiResponse({ status: 200, description: 'Returns attachment information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  findOne(@Param('id') id: string) {
    return this.attachmentsService.findOne(id);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Download an attachment file' })
  @ApiParam({ name: 'id', description: 'Attachment UUID' })
  @ApiResponse({ status: 200, description: 'Returns file content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buffer, attachment } = await this.attachmentsService.getFileBuffer(id);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalFilename}"`,
    );
    res.send(buffer);
  }

  @Get('attachments/:id/download-url')
  @ApiOperation({ summary: 'Get signed download URL for an attachment (private storage)' })
  @ApiParam({ name: 'id', description: 'Attachment UUID' })
  @ApiResponse({ status: 200, description: 'Returns signed URL when available' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  getDownloadUrl(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', description: 'Attachment UUID' })
  @ApiResponse({ status: 200, description: 'Attachment successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  remove(@Param('id') id: string) {
    return this.attachmentsService.remove(id);
  }
}

