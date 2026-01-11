import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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

  async search(dto: SearchQueryDto): Promise<SearchResult> {
    const { q, type = 'all', limit = 5 } = dto;
    const searchTerm = `%${q}%`;

    const results: SearchResult = {
      projects: [],
      issues: [],
      users: [],
      total: 0,
    };

    // Search Projects
    if (type === 'all' || type === 'projects') {
      results.projects = await this.projectsRepository.find({
        where: [
          { name: Like(searchTerm) },
          { key: Like(searchTerm) },
          { description: Like(searchTerm) },
        ],
        take: limit,
        order: { updatedAt: 'DESC' },
      });
    }

    // Search Issues
    if (type === 'all' || type === 'issues') {
      results.issues = await this.issuesRepository.find({
        where: [
          { summary: Like(searchTerm) },
          { description: Like(searchTerm) },
        ],
        relations: ['project', 'assignee', 'status', 'type', 'priority'],
        take: limit,
        order: { updatedAt: 'DESC' },
      });
    }

    // Search Users
    if (type === 'all' || type === 'users') {
      results.users = await this.usersRepository.find({
        where: [
          { username: Like(searchTerm) },
          { displayName: Like(searchTerm) },
          { email: Like(searchTerm) },
        ],
        take: limit,
        order: { updatedAt: 'DESC' },
      });
    }

    results.total = results.projects.length + results.issues.length + results.users.length;

    return results;
  }
}

