import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';
import { WorkflowTransition } from './entities/workflow-transition.entity';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { CreateTransitionDto } from './dto/create-transition.dto';
import { Project } from '../projects/entities/project.entity';
import { Status } from '../statuses/entities/status.entity';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private workflowsRepository: Repository<Workflow>,
    @InjectRepository(WorkflowTransition)
    private transitionsRepository: Repository<WorkflowTransition>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(Status)
    private statusesRepository: Repository<Status>,
  ) {}

  private async ensureProjectHasNoWorkflow(projectId: string, excludeWorkflowId?: string) {
    const existing = await this.workflowsRepository.findOne({
      where: {
        isActive: true,
        project: { id: projectId } as any,
      },
      relations: ['project'],
    });

    if (existing && existing.id !== excludeWorkflowId) {
      throw new BadRequestException('This project already has a workflow assigned');
    }
  }

  async create(createWorkflowDto: CreateWorkflowDto): Promise<Workflow> {
    const project = await this.projectsRepository.findOne({
      where: { id: createWorkflowDto.projectId },
    });
    if (!project) {
      throw new NotFoundException(
        `Project with ID ${createWorkflowDto.projectId} not found`,
      );
    }
    await this.ensureProjectHasNoWorkflow(createWorkflowDto.projectId);

    const workflow = this.workflowsRepository.create({
      name: createWorkflowDto.name,
      description: createWorkflowDto.description,
      project,
      isActive: createWorkflowDto.isActive ?? true,
    });

    return await this.workflowsRepository.save(workflow);
  }

  async findAll(): Promise<Workflow[]> {
    return await this.workflowsRepository.find({
      relations: ['project', 'transitions', 'transitions.fromStatus', 'transitions.toStatus'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Workflow> {
    const workflow = await this.workflowsRepository.findOne({
      where: { id },
      relations: ['project', 'transitions', 'transitions.fromStatus', 'transitions.toStatus'],
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  async update(id: string, updateWorkflowDto: UpdateWorkflowDto): Promise<Workflow> {
    const workflow = await this.findOne(id);

    if (updateWorkflowDto.projectId !== undefined) {
      const currentProjectId = workflow.project?.id || null;
      const targetProjectId = updateWorkflowDto.projectId;

      if (currentProjectId && targetProjectId !== currentProjectId) {
        throw new BadRequestException(
          'Detach workflow from current project before assigning it to another project',
        );
      }

      const project = await this.projectsRepository.findOne({
        where: { id: updateWorkflowDto.projectId },
      });
      if (!project) {
        throw new NotFoundException(
          `Project with ID ${updateWorkflowDto.projectId} not found`,
        );
      }
      await this.ensureProjectHasNoWorkflow(updateWorkflowDto.projectId, workflow.id);
      workflow.project = project;
    }

    Object.assign(workflow, {
      name: updateWorkflowDto.name,
      description: updateWorkflowDto.description,
      isActive: updateWorkflowDto.isActive,
    });

    return await this.workflowsRepository.save(workflow);
  }

  async detachFromProject(id: string): Promise<Workflow> {
    const workflow = await this.findOne(id);
    workflow.project = null;
    workflow.isActive = false;
    return await this.workflowsRepository.save(workflow);
  }

  async getByProject(projectId: string): Promise<Workflow | null> {
    return await this.workflowsRepository.findOne({
      where: { isActive: true, project: { id: projectId } as any },
      relations: ['project', 'transitions', 'transitions.fromStatus', 'transitions.toStatus'],
    });
  }

  async remove(id: string): Promise<void> {
    const workflow = await this.findOne(id);
    await this.workflowsRepository.remove(workflow);
  }

  async getTransitions(id: string): Promise<WorkflowTransition[]> {
    const workflow = await this.findOne(id);
    return workflow.transitions || [];
  }

  async addTransition(
    workflowId: string,
    createTransitionDto: CreateTransitionDto,
  ): Promise<WorkflowTransition> {
    const workflow = await this.findOne(workflowId);

    const fromStatus = await this.statusesRepository.findOne({
      where: { id: createTransitionDto.fromStatusId },
    });
    if (!fromStatus) {
      throw new NotFoundException(
        `Status with ID ${createTransitionDto.fromStatusId} not found`,
      );
    }

    const toStatus = await this.statusesRepository.findOne({
      where: { id: createTransitionDto.toStatusId },
    });
    if (!toStatus) {
      throw new NotFoundException(
        `Status with ID ${createTransitionDto.toStatusId} not found`,
      );
    }

    const transition = this.transitionsRepository.create({
      workflow,
      fromStatus,
      toStatus,
    });

    return await this.transitionsRepository.save(transition);
  }

  async removeTransition(workflowId: string, transitionId: string): Promise<void> {
    const workflow = await this.findOne(workflowId);

    const transition = await this.transitionsRepository.findOne({
      where: { id: transitionId },
      relations: ['workflow'],
    });

    if (!transition) {
      throw new NotFoundException(`Transition with ID ${transitionId} not found`);
    }

    if (transition.workflow.id !== workflowId) {
      throw new NotFoundException(
        `Transition ${transitionId} does not belong to workflow ${workflowId}`,
      );
    }

    await this.transitionsRepository.remove(transition);
  }
}

