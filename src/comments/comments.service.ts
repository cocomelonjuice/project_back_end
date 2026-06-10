import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Issue } from '../issues/entities/issue.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(Issue)
    private issuesRepository: Repository<Issue>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    issueId: string,
    authorId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const issue = await this.issuesRepository.findOne({
      where: { id: issueId },
      relations: ['assignee', 'reporter'],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const author = await this.usersRepository.findOne({
      where: { id: authorId },
    });

    if (!author) {
      throw new NotFoundException(`User with ID ${authorId} not found`);
    }

    const comment = this.commentsRepository.create({
      ...createCommentDto,
      issue,
      author,
    });

    const savedComment = await this.commentsRepository.save(comment);

    // Create notifications for assignee and reporter (but not the comment author)
    try {
      const usersToNotify: User[] = [];

      // Notify assignee if exists and is not the comment author
      if (issue.assignee && issue.assignee.id !== authorId) {
        usersToNotify.push(issue.assignee);
      }

      // Notify reporter if exists, is not the comment author, and is not already in the list
      if (
        issue.reporter &&
        issue.reporter.id !== authorId &&
        issue.reporter.id !== issue.assignee?.id
      ) {
        usersToNotify.push(issue.reporter);
      }

      // Create notifications for each user
      for (const user of usersToNotify) {
        await this.notificationsService.create(user.id, {
          title: 'New comment on issue',
          message: `${author.displayName || author.username} commented on issue "${issue.summary}"`,
          type: 'comment_added',
          issueId: issue.id,
        });
      }
    } catch (error) {
      // Log error but don't fail the comment creation
      console.error('Failed to create notification for comment:', error);
    }

    return savedComment;
  }

  async findByIssue(issueId: string): Promise<Comment[]> {
    const issue = await this.issuesRepository.findOne({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    return await this.commentsRepository.find({
      where: { issue: { id: issueId } },
      relations: ['author', 'issue'],
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author', 'issue'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    return comment;
  }

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOne(id);

    Object.assign(comment, updateCommentDto);

    return await this.commentsRepository.save(comment);
  }

  async remove(id: string): Promise<void> {
    const comment = await this.findOne(id);
    await this.commentsRepository.remove(comment);
  }
}
