import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board } from './entities/board.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private boardsRepository: Repository<Board>,
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
  ) {}

  async create(projectId: string, createBoardDto: CreateBoardDto): Promise<Board> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const board = this.boardsRepository.create({
      ...createBoardDto,
      project,
    });

    return await this.boardsRepository.save(board);
  }

  async findByProject(projectId: string): Promise<Board[]> {
    return await this.boardsRepository.find({
      where: { project: { id: projectId } },
      relations: ['project'],
    });
  }

  async findOne(id: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id },
      relations: ['project', 'sprints'],
    });

    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found`);
    }

    return board;
  }

  async update(id: string, updateBoardDto: UpdateBoardDto): Promise<Board> {
    const board = await this.findOne(id);

    Object.assign(board, updateBoardDto);

    return await this.boardsRepository.save(board);
  }

  async remove(id: string): Promise<void> {
    const board = await this.findOne(id);
    await this.boardsRepository.remove(board);
  }
}


