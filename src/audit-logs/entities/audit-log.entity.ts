import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ length: 50 })
  action: string; // 'create', 'update', 'delete', etc.

  @Column({ length: 50 })
  entityType: string; // 'issue', 'project', 'user', etc.

  @Column({ type: 'uuid', nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newValues?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
