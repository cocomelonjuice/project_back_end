import { Injectable, NotFoundException, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { Issue } from './entities/issue.entity';
import { Project } from '../projects/entities/project.entity';
import { IssueType } from '../issue-types/entities/issue-type.entity';
import { Priority } from '../priorities/entities/priority.entity';
import { Status } from '../statuses/entities/status.entity';
import { User } from '../users/entities/user.entity';
import { Sprint } from '../sprints/entities/sprint.entity';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';
import { AssignIssueDto } from './dto/assign-issue.dto';
import { TransitionIssueDto } from './dto/transition-issue.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Workflow } from '../workflows/entities/workflow.entity';

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly issuesRepository: Repository<Issue>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(IssueType)
    private readonly issueTypesRepository: Repository<IssueType>,
    @InjectRepository(Priority)
    private readonly prioritiesRepository: Repository<Priority>,
    @InjectRepository(Status)
    private readonly statusesRepository: Repository<Status>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Sprint)
    private readonly sprintsRepository: Repository<Sprint>,
    @InjectRepository(Workflow)
    private readonly workflowsRepository: Repository<Workflow>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getProject(projectId: string) {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  private async getIssue(id: string) {
    const issue = await this.issuesRepository.findOne({
      where: { id },
      relations: [
        'project',
        'type',
        'priority',
        'status',
        'assignee',
        'reporter',
        'sprint',
        'labels',
      ],
    });
    if (!issue) {
      throw new NotFoundException(`Issue ${id} not found`);
    }
    return issue;
  }

  private async resolveOptionalRelation<T extends ObjectLiteral>(
    repository: Repository<T>,
    id?: string,
    label?: string,
  ) {
    if (!id) {
      return null;
    }
    const entity = await repository.findOne({ where: { id } as any });
    if (!entity) {
      throw new NotFoundException(`${label ?? 'Entity'} ${id} not found`);
    }
    return entity;
  }

  private async validateSprintUsage(projectId: string, sprint: Sprint | null) {
    if (!sprint) return;

    const sprintWithBoard = await this.sprintsRepository.findOne({
      where: { id: sprint.id },
      relations: ['board', 'board.project'],
    });

    if (!sprintWithBoard?.board?.project?.id) {
      throw new BadRequestException('Selected sprint is invalid');
    }

    if (sprintWithBoard.board.project.id !== projectId) {
      throw new BadRequestException('Sprint does not belong to this project');
    }

    if ((sprintWithBoard.board.type || '').toLowerCase() === 'kanban') {
      throw new BadRequestException('Cannot assign sprint for issues in Kanban board');
    }
  }

  private async getEffectiveWorkflow(projectId: string) {
    const activeProjectWorkflows = await this.workflowsRepository.find({
      where: {
        isActive: true,
        project: { id: projectId } as any,
      },
      relations: ['transitions', 'transitions.fromStatus', 'transitions.toStatus'],
    });

    if (activeProjectWorkflows.length > 1) {
      throw new BadRequestException(
        'Project has multiple active workflows. Please keep only one active workflow.',
      );
    }

    return activeProjectWorkflows[0] || null;
  }

  private async validateWorkflowTransition(
    issue: Issue,
    nextStatusId: string,
  ) {
    if (!issue.status?.id || issue.status.id === nextStatusId) {
      return;
    }

    const workflow = await this.getEffectiveWorkflow(issue.project.id);
    if (!workflow) {
      throw new BadRequestException(
        'Project has no active workflow assigned. Please assign a workflow before changing issue status.',
      );
    }

    const currentStatus = issue.status;
    const targetStatus = await this.statusesRepository.findOne({
      where: { id: nextStatusId } as any,
    });
    if (!targetStatus) {
      throw new NotFoundException(`Status ${nextStatusId} not found`);
    }

    const currentCategory = (currentStatus.category || '').toLowerCase();
    const targetCategory = (targetStatus.category || '').toLowerCase();

    if (currentCategory === targetCategory) {
      // Allow switching between statuses within same category.
      return;
    }

    const transitions = workflow.transitions || [];
    if (transitions.length === 0) {
      throw new BadRequestException(
        'No transitions are configured for the active workflow',
      );
    }

    // Transition rules are interpreted at category level.
    // Auto-backward is enabled: A->B also permits B->A.
    const isAllowed = transitions.some((transition) => {
      const fromCategory = (transition.fromStatus?.category || '').toLowerCase();
      const toCategory = (transition.toStatus?.category || '').toLowerCase();
      const directMatch =
        fromCategory === currentCategory && toCategory === targetCategory;
      const backwardMatch =
        fromCategory === targetCategory && toCategory === currentCategory;
      return directMatch || backwardMatch;
    });

    if (!isAllowed) {
      const sourceName = issue.status?.name || 'Unknown';
      const targetName = targetStatus?.name || 'Unknown';
      throw new BadRequestException(
        `Invalid workflow transition: "${sourceName}" -> "${targetName}"`,
      );
    }
  }

  async create(projectId: string, dto: CreateIssueDto) {
    const project = await this.getProject(projectId);
    const [type, priority, status, assignee, reporter, sprint] = await Promise.all([
      this.resolveOptionalRelation(
        this.issueTypesRepository,
        dto.typeId,
        'Issue type',
      ),
      this.resolveOptionalRelation(
        this.prioritiesRepository,
        dto.priorityId,
        'Priority',
      ),
      this.resolveOptionalRelation(
        this.statusesRepository,
        dto.statusId,
        'Status',
      ),
      this.resolveOptionalRelation(
        this.usersRepository,
        dto.assigneeId,
        'Assignee',
      ),
      this.resolveOptionalRelation(
        this.usersRepository,
        dto.reporterId,
        'Reporter',
      ),
      this.resolveOptionalRelation(
        this.sprintsRepository,
        dto.sprintId,
        'Sprint',
      ),
    ]);

    await this.validateSprintUsage(project.id, sprint as Sprint | null);

    const issue = this.issuesRepository.create({
      summary: dto.summary,
      description: dto.description,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      project,
      type,
      priority,
      status,
      assignee,
      reporter,
      sprint,
    });

    const savedIssue = await this.issuesRepository.save(issue);

    // Create notification for assignee if issue is assigned
    if (savedIssue.assignee) {
      try {
        await this.notificationsService.create(savedIssue.assignee.id, {
          title: 'Issue assigned to you',
          message: `Issue "${savedIssue.summary}" has been assigned to you`,
          type: 'issue_assigned',
          issueId: savedIssue.id,
        });
      } catch (error) {
        // Log error but don't fail the issue creation
        console.error('Failed to create notification for issue assignment:', error);
      }
    }

    return savedIssue;
  }

  async findByProject(projectId: string, query: QueryIssuesDto) {
    try {
      await this.getProject(projectId);

      const qb = this.issuesRepository
        .createQueryBuilder('issue')
        .leftJoinAndSelect('issue.project', 'project')
        .leftJoinAndSelect('issue.type', 'type')
        .leftJoinAndSelect('issue.priority', 'priority')
        .leftJoinAndSelect('issue.status', 'status')
        .leftJoinAndSelect('issue.assignee', 'assignee')
        .leftJoinAndSelect('issue.reporter', 'reporter')
        .leftJoinAndSelect('issue.sprint', 'sprint')
        .leftJoinAndSelect('issue.labels', 'labels')
        .where('project.id = :projectId', { projectId });

      if (query.statusId) {
        qb.andWhere('status.id = :statusId', { statusId: query.statusId });
      }

      if (query.assigneeId) {
        qb.andWhere('assignee.id = :assigneeId', { assigneeId: query.assigneeId });
      }

      if (query.priorityId) {
        qb.andWhere('priority.id = :priorityId', { priorityId: query.priorityId });
      }

      return await qb.getMany();
    } catch (error) {
      console.error('Error in findByProject:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  findOne(id: string) {
    return this.getIssue(id);
  }

  async update(id: string, dto: UpdateIssueDto) {
    const issue = await this.getIssue(id);
    const oldAssignee = issue.assignee;
    const oldStatus = issue.status;

    if (dto.summary !== undefined) {
      issue.summary = dto.summary;
    }

    if (dto.description !== undefined) {
      issue.description = dto.description;
    }

    if (dto.dueDate !== undefined) {
      issue.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    if (dto.typeId !== undefined) {
      issue.type = await this.resolveOptionalRelation(
        this.issueTypesRepository,
        dto.typeId,
        'Issue type',
      );
    }

    if (dto.priorityId !== undefined) {
      issue.priority = await this.resolveOptionalRelation(
        this.prioritiesRepository,
        dto.priorityId,
        'Priority',
      );
    }

    if (dto.statusId !== undefined) {
      await this.validateWorkflowTransition(issue, dto.statusId);
      issue.status = await this.resolveOptionalRelation(
        this.statusesRepository,
        dto.statusId,
        'Status',
      );
    }

    if (dto.assigneeId !== undefined) {
      issue.assignee = await this.resolveOptionalRelation(
        this.usersRepository,
        dto.assigneeId,
        'Assignee',
      );
    }

    if (dto.reporterId !== undefined) {
      issue.reporter = await this.resolveOptionalRelation(
        this.usersRepository,
        dto.reporterId,
        'Reporter',
      );
    }

    if (dto.sprintId !== undefined) {
      const resolvedSprint = await this.resolveOptionalRelation(
        this.sprintsRepository,
        dto.sprintId,
        'Sprint',
      );
      await this.validateSprintUsage(issue.project.id, resolvedSprint as Sprint | null);
      issue.sprint = resolvedSprint;
    }

    const savedIssue = await this.issuesRepository.save(issue);

    // Create notifications for changes
    try {
      // Notify if assignee changed
      if (dto.assigneeId !== undefined && savedIssue.assignee && savedIssue.assignee.id !== oldAssignee?.id) {
        await this.notificationsService.create(savedIssue.assignee.id, {
          title: 'Issue assigned to you',
          message: `Issue "${savedIssue.summary}" has been assigned to you`,
          type: 'issue_assigned',
          issueId: savedIssue.id,
        });
      }

      // Notify if status changed and assignee exists
      if (dto.statusId !== undefined && savedIssue.status && savedIssue.status.id !== oldStatus?.id && savedIssue.assignee) {
        await this.notificationsService.create(savedIssue.assignee.id, {
          title: 'Issue status changed',
          message: `Issue "${savedIssue.summary}" status changed to "${savedIssue.status.name}"`,
          type: 'status_changed',
          issueId: savedIssue.id,
        });
      }
    } catch (error) {
      // Log error but don't fail the update
      console.error('Failed to create notification for issue update:', error);
    }

    return savedIssue;
  }

  async remove(id: string) {
    const issue = await this.getIssue(id);
    await this.issuesRepository.remove(issue);
  }

  async assign(id: string, dto: AssignIssueDto) {
    const issue = await this.getIssue(id);
    const oldAssignee = issue.assignee;
    issue.assignee = await this.resolveOptionalRelation(
      this.usersRepository,
      dto.assigneeId ?? undefined,
      'Assignee',
    );
    const savedIssue = await this.issuesRepository.save(issue);

    // Create notification for new assignee if assignee changed
    if (savedIssue.assignee && savedIssue.assignee.id !== oldAssignee?.id) {
      try {
        await this.notificationsService.create(savedIssue.assignee.id, {
          title: 'Issue assigned to you',
          message: `Issue "${savedIssue.summary}" has been assigned to you`,
          type: 'issue_assigned',
          issueId: savedIssue.id,
        });
      } catch (error) {
        console.error('Failed to create notification for issue assignment:', error);
      }
    }

    return savedIssue;
  }

  async transition(id: string, dto: TransitionIssueDto) {
    const issue = await this.getIssue(id);
    const oldStatus = issue.status;
    await this.validateWorkflowTransition(issue, dto.statusId);
    issue.status = await this.resolveOptionalRelation(
      this.statusesRepository,
      dto.statusId,
      'Status',
    );
    const savedIssue = await this.issuesRepository.save(issue);

    // Create notification for assignee if status changed
    if (savedIssue.assignee && savedIssue.status && savedIssue.status.id !== oldStatus?.id) {
      try {
        await this.notificationsService.create(savedIssue.assignee.id, {
          title: 'Issue status changed',
          message: `Issue "${savedIssue.summary}" status changed to "${savedIssue.status.name}"`,
          type: 'status_changed',
          issueId: savedIssue.id,
        });
      } catch (error) {
        console.error('Failed to create notification for status change:', error);
      }
    }

    return savedIssue;
  }
}

