import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';
import { Issue } from '../issues/entities/issue.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AttachmentsService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
    @InjectRepository(Issue)
    private issuesRepository: Repository<Issue>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async create(
    issueId: string,
    uploadedById: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<Attachment> {
    const issue = await this.issuesRepository.findOne({
      where: { id: issueId },
      relations: ['assignee', 'reporter'],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const uploadedBy = await this.usersRepository.findOne({
      where: { id: uploadedById },
    });

    if (!uploadedBy) {
      throw new NotFoundException(`User with ID ${uploadedById} not found`);
    }

    // Generate unique filename
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Save file to disk
    fs.writeFileSync(filePath, file.buffer);

    const attachment = this.attachmentsRepository.create({
      filename: fileName,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath: filePath,
      issue,
      uploadedBy,
    });

    const savedAttachment = await this.attachmentsRepository.save(attachment);

    // Create notifications for assignee and reporter (but not the uploader)
    try {
      const usersToNotify: User[] = [];
      
      // Notify assignee if exists and is not the uploader
      if (issue.assignee && issue.assignee.id !== uploadedById) {
        usersToNotify.push(issue.assignee);
      }
      
      // Notify reporter if exists, is not the uploader, and is not already in the list
      if (issue.reporter && issue.reporter.id !== uploadedById && issue.reporter.id !== issue.assignee?.id) {
        usersToNotify.push(issue.reporter);
      }

      // Create notifications for each user
      for (const user of usersToNotify) {
        await this.notificationsService.create(user.id, {
          title: 'New attachment on issue',
          message: `${uploadedBy.displayName || uploadedBy.username} uploaded "${file.originalname}" to issue "${issue.summary}"`,
          type: 'attachment_added',
          issueId: issue.id,
        });
      }
    } catch (error) {
      // Log error but don't fail the attachment creation
      console.error('Failed to create notification for attachment:', error);
    }

    return savedAttachment;
  }

  async findByIssue(issueId: string): Promise<Attachment[]> {
    const issue = await this.issuesRepository.findOne({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    return await this.attachmentsRepository.find({
      where: { issue: { id: issueId } },
      relations: ['uploadedBy', 'issue'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id },
      relations: ['uploadedBy', 'issue'],
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${id} not found`);
    }

    return attachment;
  }

  async getFileBuffer(id: string): Promise<{ buffer: Buffer; attachment: Attachment }> {
    const attachment = await this.findOne(id);

    if (!fs.existsSync(attachment.filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    const buffer = fs.readFileSync(attachment.filePath);

    return { buffer, attachment };
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.findOne(id);

    // Delete file from disk
    if (fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }

    await this.attachmentsRepository.remove(attachment);
  }
}

