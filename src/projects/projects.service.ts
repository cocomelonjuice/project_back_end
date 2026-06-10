import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  private async generateProjectKey(length = 7): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    while (true) {
      let key = '';
      for (let i = 0; i < length; i += 1) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      const existing = await this.projectsRepository.findOne({
        where: { key },
      });
      if (!existing) {
        return key;
      }
    }
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const generatedKey = await this.generateProjectKey(7);
    const project = this.projectsRepository.create({
      ...dto,
      key: dto.key?.toUpperCase() || generatedKey,
    });
    return this.projectsRepository.save(project);
  }

  findAll(): Promise<Project[]> {
    return this.projectsRepository.find();
  }

  async findManagedProjects(
    userId: string,
    isAdmin: boolean,
  ): Promise<Project[]> {
    if (isAdmin) {
      return this.findAll();
    }

    return this.projectsRepository
      .createQueryBuilder('project')
      .innerJoin('project.roles', 'role')
      .innerJoin('role.users', 'user', 'user.id = :userId', { userId })
      .orderBy('project.updatedAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    const { key: _ignoredKey, ...rest } = dto;
    Object.assign(project, rest);
    return this.projectsRepository.save(project);
  }

  async remove(id: string): Promise<void> {
    // First check if project exists
    const project = await this.findOne(id);

    try {
      // Use delete() instead of remove() - it handles foreign key constraints better
      const result = await this.projectsRepository.delete(id);

      // Check if deletion was successful
      if (result.affected === 0) {
        throw new NotFoundException(`Project ${id} not found`);
      }
    } catch (error: any) {
      // If it's a foreign key constraint error, provide a helpful message
      if (
        error.code === '23503' ||
        error.message?.includes('foreign key') ||
        error.message?.includes('constraint') ||
        error.message?.includes('violates foreign key')
      ) {
        throw new BadRequestException(
          'Cannot delete project: it has related issues, boards, or roles. Please delete or reassign them first.',
        );
      }

      // If it's already a NestJS exception, re-throw it
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // For other errors, log and throw a generic error
      console.error(`Error deleting project ${id}:`, error);
      throw new BadRequestException(
        `Failed to delete project: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async getTeamMembers(
    projectId: string,
  ): Promise<Array<{ user: User; role: Role }>> {
    // Verify project exists
    await this.findOne(projectId);

    // Get all roles that belong to this project
    const projectRoles = await this.rolesRepository
      .createQueryBuilder('role')
      .innerJoin('role.projects', 'project', 'project.id = :projectId', {
        projectId,
      })
      .getMany();

    if (projectRoles.length === 0) {
      return [];
    }

    const roleIds = projectRoles.map((r) => r.id);

    // Get all users who have any of these roles
    const users = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role', 'role.id IN (:...roleIds)', { roleIds })
      .select([
        'user.id',
        'user.username',
        'user.email',
        'user.displayName',
        'user.isActive',
        'user.createdAt',
        'user.updatedAt',
      ])
      .getMany();

    // Build team members: for each user, find their role in this project
    // Use a more direct query to get the specific role assignment
    const teamMembers: Array<{ user: User; role: Role }> = [];

    for (const user of users) {
      // Query to find which specific role this user has for this project
      // We need to check the join tables to get the exact role assignment
      const userRoleAssignment = await this.usersRepository
        .createQueryBuilder('user')
        .innerJoin('user.roles', 'role')
        .innerJoin('role.projects', 'project', 'project.id = :projectId', {
          projectId,
        })
        .where('user.id = :userId', { userId: user.id })
        .select([
          'role.id',
          'role.name',
          'role.description',
          'role.permissions',
        ])
        .getRawMany();

      if (userRoleAssignment && userRoleAssignment.length > 0) {
        // Get the most recent role assignment (or first one if multiple)
        // In a real app, you might want to track assignment date
        const roleId = userRoleAssignment[0].role_id;
        const role = projectRoles.find((r) => r.id === roleId);

        if (role) {
          teamMembers.push({
            user,
            role,
          });
        }
      }
    }

    return teamMembers;
  }
}
