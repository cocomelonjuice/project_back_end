import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Issue } from '../../issues/entities/issue.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Issue, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue?: Issue | null;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ length: 50 })
  type: string; // 'issue_assigned', 'comment_added', 'status_changed', etc.

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn({ 
    name: 'created_at',
    type: 'timestamp with time zone', // Explicitly use timestamp with time zone for UTC
  })
  createdAt: Date;
}


