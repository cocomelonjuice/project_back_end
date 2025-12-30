import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    const project = this.projectsRepository.create({
      ...dto,
      key: dto.key.toUpperCase(),
    });
    return this.projectsRepository.save(project);
  }

  findAll(): Promise<Project[]> {
    return this.projectsRepository.find();
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
    Object.assign(project, dto);
    if (dto.key) {
      project.key = dto.key.toUpperCase();
    }
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
          'Cannot delete project: it has related issues, boards, or roles. Please delete or reassign them first.'
        );
      }
      
      // If it's already a NestJS exception, re-throw it
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      // For other errors, log and throw a generic error
      console.error(`Error deleting project ${id}:`, error);
      throw new BadRequestException(`Failed to delete project: ${error.message || 'Unknown error'}`);
    }
  }
}

