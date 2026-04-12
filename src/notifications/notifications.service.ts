import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { User } from '../users/entities/user.entity';
import { Issue } from '../issues/entities/issue.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Issue)
    private issuesRepository: Repository<Issue>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    userId: string,
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    let issue: Issue | null = null;
    if (createNotificationDto.issueId) {
      issue = await this.issuesRepository.findOne({
        where: { id: createNotificationDto.issueId },
      });
      if (!issue) {
        throw new NotFoundException(
          `Issue with ID ${createNotificationDto.issueId} not found`,
        );
      }
    }

    const notification = this.notificationsRepository.create({
      ...createNotificationDto,
      user,
      issue,
    });

    const saved = await this.notificationsRepository.save(notification);
    void this.pushNotificationRealtime(userId, saved.id);
    return saved;
  }

  /** Shape matches REST list items; used for Socket.IO `notification:new`. */
  private toSocketPayload(n: Notification): Record<string, unknown> {
    const issue = n.issue;
    return {
      id: n.id,
      userId: n.user?.id,
      issueId: issue?.id ?? undefined,
      issue: issue
        ? {
            id: issue.id,
            summary: issue.summary,
            projectId: issue.project?.id,
            project: issue.project ? { id: issue.project.id } : undefined,
          }
        : undefined,
      title: n.title,
      message: n.message ?? undefined,
      type: n.type,
      isRead: n.isRead,
      createdAt:
        n.createdAt instanceof Date
          ? n.createdAt.toISOString()
          : String(n.createdAt),
    };
  }

  private async pushNotificationRealtime(userId: string, notificationId: string) {
    try {
      const full = await this.notificationsRepository.findOne({
        where: { id: notificationId },
        relations: ['user', 'issue', 'issue.project'],
      });
      if (full) {
        this.notificationsGateway.emitNotificationNew(
          userId,
          this.toSocketPayload(full),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Real-time notification emit failed: ${msg}`);
    }
  }

  async findByUser(userId: string): Promise<Notification[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return await this.notificationsRepository.find({
      where: { user: { id: userId } },
      relations: ['user', 'issue', 'issue.project'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
      relations: ['user', 'issue', 'issue.project'],
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.findOne(id);
    notification.isRead = true;
    return await this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.notificationsRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true },
    );

    return { count: result.affected || 0 };
  }
}

