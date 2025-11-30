import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Priority } from './entities/priority.entity';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';

@Injectable()
export class PrioritiesService {
  constructor(
    @InjectRepository(Priority)
    private readonly prioritiesRepository: Repository<Priority>,
  ) {}

  create(dto: CreatePriorityDto) {
    const priority = this.prioritiesRepository.create(dto);
    return this.prioritiesRepository.save(priority);
  }

  findAll() {
    return this.prioritiesRepository.find({
      order: { orderNum: 'ASC' },
    });
  }

  async findOne(id: string) {
    const priority = await this.prioritiesRepository.findOne({ where: { id } });
    if (!priority) {
      throw new NotFoundException(`Priority ${id} not found`);
    }
    return priority;
  }

  async update(id: string, dto: UpdatePriorityDto) {
    const priority = await this.findOne(id);
    Object.assign(priority, dto);
    return this.prioritiesRepository.save(priority);
  }

  async remove(id: string) {
    const priority = await this.findOne(id);
    await this.prioritiesRepository.remove(priority);
  }
}





