import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { User } from '../users/entities/user.entity';
import { Issue } from '../issues/entities/issue.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Issue)
    private issuesRepository: Repository<Issue>,
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

    return await this.notificationsRepository.save(notification);
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
      relations: ['user', 'issue'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
      relations: ['user', 'issue'],
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

