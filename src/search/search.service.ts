import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Issue } from '../issues/entities/issue.entity';
import { User } from '../users/entities/user.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResult } from './interfaces/search-result.interface';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Issue)
    private readonly issuesRepository: Repository<Issue>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private normalizeFilterValues(
    multiValues?: string[],
    singleValue?: string,
  ): string[] {
    const fromMulti = Array.isArray(multiValues) ? multiValues : [];
    const fromSingle = typeof singleValue === 'string' ? [singleValue] : [];
    return [...fromMulti, ...fromSingle]
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
  }

  private normalizeUpper(values: string[]): string[] {
    return values
      .map((value) => value.trim().toUpperCase())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
  }

  private normalizeLower(values: string[]): string[] {
    return values
      .map((value) => value.trim().toLowerCase())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
  }

  async search(dto: SearchQueryDto): Promise<SearchResult> {
    const {
      q = '',
      type = 'all',
      limit = 5,
      projectKey,
      projectType,
      issueStatus,
      issuePriority,
      assignee,
      projectKeys: projectKeysRaw,
      projectTypes: projectTypesRaw,
      issueStatusIds: issueStatusIdsRaw,
      issuePriorityIds: issuePriorityIdsRaw,
      assigneeIds: assigneeIdsRaw,
      issueKeys: issueKeysRaw,
    } = dto;
    const trimmedQuery = q.trim();
    const hasSearchQuery = trimmedQuery.length > 0;
    const searchTerm = `%${trimmedQuery}%`;
    const normalizedLimit = Math.max(1, Math.min(limit || 5, 20));
    const projectKeys = this.normalizeFilterValues(projectKeysRaw, projectKey);
    const projectTypes = this.normalizeFilterValues(projectTypesRaw, projectType);
    const issueStatusIds = this.normalizeFilterValues(issueStatusIdsRaw, issueStatus);
    const issuePriorityIds = this.normalizeFilterValues(
      issuePriorityIdsRaw,
      issuePriority,
    );
    const assigneeIds = this.normalizeFilterValues(assigneeIdsRaw, assignee);
    const issueKeys = this.normalizeFilterValues(issueKeysRaw);
    const normalizedProjectKeys = this.normalizeUpper(projectKeys);
    const normalizedProjectTypes = this.normalizeLower(projectTypes);
    const normalizedIssueKeys = this.normalizeUpper(issueKeys);
    const issueKeySuffixes = normalizedIssueKeys
      .map((key) => {
        const parts = key.split('-');
        return parts.length > 1 ? parts[parts.length - 1] : '';
      })
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    const hasProjectFilters =
      normalizedProjectKeys.length > 0 || normalizedProjectTypes.length > 0;
    const hasIssueFilters =
      issueStatusIds.length > 0 ||
      issuePriorityIds.length > 0 ||
      assigneeIds.length > 0 ||
      normalizedIssueKeys.length > 0;
    const hasAnyStructuredFilters = hasProjectFilters || hasIssueFilters;
    const shouldQueryProjects =
      type === 'projects' ||
      (type === 'all' &&
        ((hasSearchQuery && !hasIssueFilters) || hasProjectFilters));
    const shouldQueryIssues =
      type === 'issues' ||
      (type === 'all' &&
        ((hasSearchQuery && !hasProjectFilters) || hasIssueFilters));

    const results: SearchResult = {
      projects: [],
      issues: [],
      users: [],
      total: 0,
    };

    // Search Projects
    if (shouldQueryProjects) {
      const projectsQb = this.projectsRepository
        .createQueryBuilder('project')
        .orderBy('project.updatedAt', 'DESC')
        .take(normalizedLimit);

      if (hasSearchQuery) {
        projectsQb.where(
          new Brackets((qb) => {
            qb.where('project.name ILIKE :searchTerm', { searchTerm })
              .orWhere('project.key ILIKE :searchTerm', { searchTerm })
              .orWhere('project.description ILIKE :searchTerm', { searchTerm });
          }),
        );
      }

      if (normalizedProjectKeys.length > 0) {
        projectsQb.andWhere('UPPER(project.key) IN (:...projectKeys)', {
          projectKeys: normalizedProjectKeys,
        });
      }

      if (normalizedProjectTypes.length > 0) {
        projectsQb.andWhere('LOWER(project.type) IN (:...projectTypes)', {
          projectTypes: normalizedProjectTypes,
        });
      }

      results.projects = await projectsQb.getMany();
    }

    // Search Issues
    if (shouldQueryIssues) {
      const issuesQb = this.issuesRepository
        .createQueryBuilder('issue')
        .leftJoinAndSelect('issue.project', 'project')
        .leftJoinAndSelect('issue.assignee', 'assignee')
        .leftJoinAndSelect('issue.status', 'status')
        .leftJoinAndSelect('issue.type', 'type')
        .leftJoinAndSelect('issue.priority', 'priority')
        .orderBy('issue.updatedAt', 'DESC')
        .take(normalizedLimit);

      if (hasSearchQuery) {
        issuesQb.where(
          new Brackets((qb) => {
            qb.where('issue.summary ILIKE :searchTerm', { searchTerm }).orWhere(
              'issue.description ILIKE :searchTerm',
              { searchTerm },
            );
          }),
        );
      }

      if (normalizedProjectKeys.length > 0) {
        issuesQb.andWhere('UPPER(project.key) IN (:...projectKeys)', {
          projectKeys: normalizedProjectKeys,
        });
      }

      if (normalizedProjectTypes.length > 0) {
        issuesQb.andWhere('LOWER(project.type) IN (:...projectTypes)', {
          projectTypes: normalizedProjectTypes,
        });
      }

      if (issueStatusIds.length > 0) {
        issuesQb.andWhere('status.id IN (:...issueStatusIds)', {
          issueStatusIds,
        });
      }

      if (issuePriorityIds.length > 0) {
        issuesQb.andWhere('priority.id IN (:...issuePriorityIds)', {
          issuePriorityIds,
        });
      }

      if (normalizedIssueKeys.length > 0) {
        issuesQb.andWhere(
          new Brackets((qb) => {
            qb.where(
              "UPPER(CONCAT(project.key, '-', UPPER(SPLIT_PART(issue.id::text, '-', 1)))) IN (:...issueKeys)",
              { issueKeys: normalizedIssueKeys },
            );
            if (issueKeySuffixes.length > 0) {
              qb.orWhere(
                "UPPER(SPLIT_PART(issue.id::text, '-', 1)) IN (:...issueKeySuffixes)",
                { issueKeySuffixes },
              );
            }
          }),
        );
      }

      if (assigneeIds.length > 0) {
        issuesQb.andWhere('assignee.id IN (:...assigneeIds)', {
          assigneeIds,
        });
      }

      results.issues = await issuesQb.getMany();
    }

    // Search Users
    if (
      (type === 'users' && hasSearchQuery) ||
      (type === 'all' && hasSearchQuery && !hasAnyStructuredFilters)
    ) {
      results.users = await this.usersRepository
        .createQueryBuilder('user')
        .where(
          new Brackets((qb) => {
            qb.where('user.username ILIKE :searchTerm', { searchTerm })
              .orWhere('user.displayName ILIKE :searchTerm', { searchTerm })
              .orWhere('user.email ILIKE :searchTerm', { searchTerm });
          }),
        )
        .orderBy('user.updatedAt', 'DESC')
        .take(normalizedLimit)
        .getMany();
    }

    results.total = results.projects.length + results.issues.length + results.users.length;

    return results;
  }
}

