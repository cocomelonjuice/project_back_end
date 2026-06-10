import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const role = this.rolesRepository.create(createRoleDto);
    return await this.rolesRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    // Return roles without relations for list view
    // Relations are only needed when getting a specific role or assigning roles
    return await this.rolesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: ['users', 'projects'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    Object.assign(role, updateRoleDto);

    return await this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    await this.rolesRepository.remove(role);
  }

  async assignRoleToUserInProject(
    projectId: string,
    roleId: string,
    userId: string,
  ): Promise<{ user: User; role: Role; project: Project }> {
    // Find entities
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if user already has a role in this project - if so, remove it first
    const projectRoles = await this.rolesRepository
      .createQueryBuilder('role')
      .innerJoin('role.projects', 'project', 'project.id = :projectId', {
        projectId,
      })
      .getMany();

    const projectRoleIds = projectRoles.map((r) => r.id);

    // Get user's current roles
    const userWithRoles = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (userWithRoles?.roles) {
      // Find roles that belong to this project
      const userRolesInProject = userWithRoles.roles.filter((r) =>
        projectRoleIds.includes(r.id),
      );

      // Remove old roles from this project (except the new one we're assigning)
      for (const oldRole of userRolesInProject) {
        if (oldRole.id !== roleId) {
          try {
            await this.usersRepository
              .createQueryBuilder()
              .relation(User, 'roles')
              .of(userId)
              .remove(oldRole.id);
          } catch (error) {
            console.warn(
              `Failed to remove old role ${oldRole.id} from user:`,
              error,
            );
          }
        }
      }
    }

    // Assign new role to user using relation manager
    try {
      const hasRole = userWithRoles?.roles?.some((r) => r.id === roleId);
      if (!hasRole) {
        await this.usersRepository
          .createQueryBuilder()
          .relation(User, 'roles')
          .of(userId)
          .add(roleId);
      }
    } catch (error) {
      console.error(
        'Error assigning role to user using relation manager:',
        error,
      );
      // Fallback: try loading and saving
      try {
        const userWithRolesFallback = await this.usersRepository.findOne({
          where: { id: userId },
          relations: ['roles'],
        });

        if (userWithRolesFallback) {
          const hasRole = userWithRolesFallback.roles?.some(
            (r) => r.id === roleId,
          );
          if (!hasRole) {
            if (!userWithRolesFallback.roles) {
              userWithRolesFallback.roles = [];
            }
            userWithRolesFallback.roles.push(role);
            await this.usersRepository.save(userWithRolesFallback);
          }
        } else {
          throw new Error('User not found');
        }
      } catch (fallbackError) {
        console.error('Error in fallback method:', fallbackError);
        throw new Error(
          `Failed to assign role to user: ${error.message || error}`,
        );
      }
    }

    // Assign role to project using relation manager
    try {
      await this.projectsRepository
        .createQueryBuilder()
        .relation(Project, 'roles')
        .of(projectId)
        .add(roleId);
    } catch (error) {
      console.error(
        'Error assigning role to project using relation manager:',
        error,
      );
      // Fallback: try loading and saving
      try {
        const projectWithRoles = await this.projectsRepository.findOne({
          where: { id: projectId },
          relations: ['roles'],
        });

        if (projectWithRoles) {
          const hasRole = projectWithRoles.roles?.some((r) => r.id === roleId);
          if (!hasRole) {
            if (!projectWithRoles.roles) {
              projectWithRoles.roles = [];
            }
            projectWithRoles.roles.push(role);
            await this.projectsRepository.save(projectWithRoles);
          }
        } else {
          console.warn('Project not found, skipping project role assignment');
        }
      } catch (fallbackError) {
        console.error('Error in fallback method for project:', fallbackError);
        // Don't throw - user role assignment succeeded, project role is optional
        console.warn(
          'Failed to assign role to project, but user role was assigned',
        );
      }
    }

    // Return entities
    return {
      user,
      role,
      project,
    };
  }

  async removeRoleFromUserInProject(
    projectId: string,
    roleId: string,
    userId: string,
  ): Promise<void> {
    // Find entities to verify they exist
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Remove role from user using relation manager
    try {
      await this.usersRepository
        .createQueryBuilder()
        .relation(User, 'roles')
        .of(userId)
        .remove(roleId);
    } catch (error) {
      console.error(
        'Error removing role from user using relation manager:',
        error,
      );
      // Fallback: try loading and saving
      try {
        const userWithRoles = await this.usersRepository.findOne({
          where: { id: userId },
          relations: ['roles'],
        });

        if (userWithRoles && userWithRoles.roles) {
          userWithRoles.roles = userWithRoles.roles.filter(
            (r) => r.id !== roleId,
          );
          await this.usersRepository.save(userWithRoles);
        }
      } catch (fallbackError) {
        console.error('Error in fallback method:', fallbackError);
        throw new Error(
          `Failed to remove role from user: ${error.message || error}`,
        );
      }
    }

    // Remove role from project if no other users have this role in this project
    // Check if any other users have this role in this project
    const otherUsersWithRole = await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role', 'role.id = :roleId', { roleId })
      .innerJoin('role.projects', 'project', 'project.id = :projectId', {
        projectId,
      })
      .where('user.id != :userId', { userId })
      .getCount();

    // Only remove role from project if no other users have it
    if (otherUsersWithRole === 0) {
      try {
        await this.projectsRepository
          .createQueryBuilder()
          .relation(Project, 'roles')
          .of(projectId)
          .remove(roleId);
      } catch (error) {
        console.error('Error removing role from project:', error);
        // Don't throw - user role removal succeeded, project role removal is optional
        console.warn(
          'Failed to remove role from project, but user role was removed',
        );
      }
    }
  }
}
