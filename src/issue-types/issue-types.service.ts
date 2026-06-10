import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueType } from './entities/issue-type.entity';
import { CreateIssueTypeDto } from './dto/create-issue-type.dto';
import { UpdateIssueTypeDto } from './dto/update-issue-type.dto';

@Injectable()
export class IssueTypesService {
  constructor(
    @InjectRepository(IssueType)
    private readonly issueTypesRepository: Repository<IssueType>,
  ) {}

  create(dto: CreateIssueTypeDto) {
    const type = this.issueTypesRepository.create(dto);
    return this.issueTypesRepository.save(type);
  }

  findAll() {
    return this.issueTypesRepository.find();
  }

  async findOne(id: string) {
    const type = await this.issueTypesRepository.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException(`Issue type ${id} not found`);
    }
    return type;
  }

  async update(id: string, dto: UpdateIssueTypeDto) {
    const type = await this.findOne(id);
    Object.assign(type, dto);
    return this.issueTypesRepository.save(type);
  }

  async remove(id: string) {
    const type = await this.findOne(id);
    await this.issueTypesRepository.remove(type);
  }
}
