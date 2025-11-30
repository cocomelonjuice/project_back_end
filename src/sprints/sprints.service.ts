import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sprint } from './entities/sprint.entity';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { Board } from '../boards/entities/board.entity';
import { Issue } from '../issues/entities/issue.entity';

@Injectable()
export class SprintsService {
  constructor(
    @InjectRepository(Sprint)
    private sprintsRepository: Repository<Sprint>,
    @InjectRepository(Board)
    private boardsRepository: Repository<Board>,
    @InjectRepository(Issue)
    private issuesRepository: Repository<Issue>,
  ) {}

  async create(boardId: string, createSprintDto: CreateSprintDto): Promise<Sprint> {
    const board = await this.boardsRepository.findOne({
      where: { id: boardId },
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }

    const sprint = this.sprintsRepository.create({
      ...createSprintDto,
      board,
      status: createSprintDto.status || 'planned',
    });

    return await this.sprintsRepository.save(sprint);
  }

  async findByBoard(boardId: string): Promise<Sprint[]> {
    return await this.sprintsRepository.find({
      where: { board: { id: boardId } },
      relations: ['board'],
      order: { startDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Sprint> {
    const sprint = await this.sprintsRepository.findOne({
      where: { id },
      relations: ['board', 'issues'],
    });

    if (!sprint) {
      throw new NotFoundException(`Sprint with ID ${id} not found`);
    }

    return sprint;
  }

  async update(id: string, updateSprintDto: UpdateSprintDto): Promise<Sprint> {
    const sprint = await this.findOne(id);

    Object.assign(sprint, updateSprintDto);

    return await this.sprintsRepository.save(sprint);
  }

  async remove(id: string): Promise<void> {
    const sprint = await this.findOne(id);
    await this.sprintsRepository.remove(sprint);
  }

  async start(id: string): Promise<Sprint> {
    const sprint = await this.findOne(id);

    if (sprint.status === 'active') {
      throw new BadRequestException('Sprint is already active');
    }

    if (sprint.status === 'closed') {
      throw new BadRequestException('Cannot start a closed sprint');
    }

    sprint.status = 'active';
    sprint.startDate = new Date();

    return await this.sprintsRepository.save(sprint);
  }

  async complete(id: string): Promise<Sprint> {
    const sprint = await this.findOne(id);

    if (sprint.status !== 'active') {
      throw new BadRequestException('Only active sprints can be completed');
    }

    sprint.status = 'closed';
    sprint.endDate = new Date();

    return await this.sprintsRepository.save(sprint);
  }

  async findIssuesBySprint(sprintId: string): Promise<Issue[]> {
    const sprint = await this.findOne(sprintId);

    return await this.issuesRepository.find({
      where: { sprint: { id: sprintId } },
      relations: ['project', 'type', 'status', 'priority', 'assignee', 'reporter'],
    });
  }
}


