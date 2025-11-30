import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Label } from './entities/label.entity';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { Issue } from '../issues/entities/issue.entity';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label)
    private labelsRepository: Repository<Label>,
    @InjectRepository(Issue)
    private issuesRepository: Repository<Issue>,
  ) {}

  async create(createLabelDto: CreateLabelDto): Promise<Label> {
    const label = this.labelsRepository.create(createLabelDto);
    return await this.labelsRepository.save(label);
  }

  async findAll(): Promise<Label[]> {
    return await this.labelsRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Label> {
    const label = await this.labelsRepository.findOne({
      where: { id },
      relations: ['issues'],
    });

    if (!label) {
      throw new NotFoundException(`Label with ID ${id} not found`);
    }

    return label;
  }

  async update(id: string, updateLabelDto: UpdateLabelDto): Promise<Label> {
    const label = await this.findOne(id);

    Object.assign(label, updateLabelDto);

    return await this.labelsRepository.save(label);
  }

  async remove(id: string): Promise<void> {
    const label = await this.findOne(id);
    await this.labelsRepository.remove(label);
  }

  async addLabelToIssue(issueId: string, labelId: string): Promise<Issue> {
    const issue = await this.issuesRepository.findOne({
      where: { id: issueId },
      relations: ['labels'],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const label = await this.labelsRepository.findOne({
      where: { id: labelId },
    });

    if (!label) {
      throw new NotFoundException(`Label with ID ${labelId} not found`);
    }

    // Check if label is already attached
    if (issue.labels && issue.labels.some((l) => l.id === labelId)) {
      return issue;
    }

    if (!issue.labels) {
      issue.labels = [];
    }

    issue.labels.push(label);
    return await this.issuesRepository.save(issue);
  }

  async removeLabelFromIssue(issueId: string, labelId: string): Promise<Issue> {
    const issue = await this.issuesRepository.findOne({
      where: { id: issueId },
      relations: ['labels'],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    if (!issue.labels || issue.labels.length === 0) {
      return issue;
    }

    issue.labels = issue.labels.filter((label) => label.id !== labelId);
    return await this.issuesRepository.save(issue);
  }
}


