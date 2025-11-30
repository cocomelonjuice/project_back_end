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
    return await this.rolesRepository.find({
      relations: ['users', 'projects'],
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
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      relations: ['roles'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const role = await this.rolesRepository.findOne({
      where: { id: roleId },
      relations: ['users', 'projects'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Add role to user if not already present
    if (!user.roles || !user.roles.some((r) => r.id === roleId)) {
      if (!user.roles) {
        user.roles = [];
      }
      user.roles.push(role);
      await this.usersRepository.save(user);
    }

    // Add role to project if not already present
    if (!project.roles || !project.roles.some((r) => r.id === roleId)) {
      if (!project.roles) {
        project.roles = [];
      }
      project.roles.push(role);
      await this.projectsRepository.save(project);
    }

    return { user, role, project };
  }
}


