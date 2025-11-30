import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Status } from './entities/status.entity';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class StatusesService {
  constructor(
    @InjectRepository(Status)
    private readonly statusesRepository: Repository<Status>,
  ) {}

  create(dto: CreateStatusDto) {
    const status = this.statusesRepository.create(dto);
    return this.statusesRepository.save(status);
  }

  findAll() {
    return this.statusesRepository.find();
  }

  async findOne(id: string) {
    const status = await this.statusesRepository.findOne({ where: { id } });
    if (!status) {
      throw new NotFoundException(`Status ${id} not found`);
    }
    return status;
  }

  async update(id: string, dto: UpdateStatusDto) {
    const status = await this.findOne(id);
    Object.assign(status, dto);
    return this.statusesRepository.save(status);
  }

  async remove(id: string) {
    const status = await this.findOne(id);
    await this.statusesRepository.remove(status);
  }
}





