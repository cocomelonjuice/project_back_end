import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(
    userId: string | null,
    createAuditLogDto: CreateAuditLogDto,
  ): Promise<AuditLog> {
    let user: User | null = null;
    if (userId) {
      user = await this.usersRepository.findOne({
        where: { id: userId },
      });
      // Don't throw error if user not found, just log without user
    }

    const auditLog = this.auditLogsRepository.create({
      ...createAuditLogDto,
      user,
    });

    return await this.auditLogsRepository.save(auditLog);
  }

  async findAll(): Promise<AuditLog[]> {
    return await this.auditLogsRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 1000, // Limit to last 1000 logs
    });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return await this.auditLogsRepository.find({
      where: { entityType, entityId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AuditLog> {
    const auditLog = await this.auditLogsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    return auditLog;
  }
}
