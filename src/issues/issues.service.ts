import { Injectable, NotFoundException } from '@nestjs/common';
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

    const issue = this.issuesRepository.create({
      summary: dto.summary,
      description: dto.description,
      project,
      type,
      priority,
      status,
      assignee,
      reporter,
      sprint,
    });

    return this.issuesRepository.save(issue);
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

    if (dto.summary !== undefined) {
      issue.summary = dto.summary;
    }

    if (dto.description !== undefined) {
      issue.description = dto.description;
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
      issue.sprint = await this.resolveOptionalRelation(
        this.sprintsRepository,
        dto.sprintId,
        'Sprint',
      );
    }

    return this.issuesRepository.save(issue);
  }

  async remove(id: string) {
    const issue = await this.getIssue(id);
    await this.issuesRepository.remove(issue);
  }

  async assign(id: string, dto: AssignIssueDto) {
    const issue = await this.getIssue(id);
    issue.assignee = await this.resolveOptionalRelation(
      this.usersRepository,
      dto.assigneeId ?? undefined,
      'Assignee',
    );
    return this.issuesRepository.save(issue);
  }

  async transition(id: string, dto: TransitionIssueDto) {
    const issue = await this.getIssue(id);
    issue.status = await this.resolveOptionalRelation(
      this.statusesRepository,
      dto.statusId,
      'Status',
    );
    return this.issuesRepository.save(issue);
  }
}

