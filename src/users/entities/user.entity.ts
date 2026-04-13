import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Attachment } from '../../attachments/entities/attachment.entity';
import { Role } from '../../roles/entities/role.entity';
import { Notification } from '../../notifications/entities/notification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({
    name: 'password_reset_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  passwordResetTokenHash: string | null;

  @Column({ name: 'password_reset_expires', type: 'timestamptz', nullable: true })
  passwordResetExpires: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Issue, (issue) => issue.assignee)
  assignedIssues: Issue[];

  @OneToMany(() => Issue, (issue) => issue.reporter)
  reportedIssues: Issue[];

  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];

  @OneToMany(() => Attachment, (attachment) => attachment.uploadedBy)
  attachments: Attachment[];

  @ManyToMany(() => Role, (role) => role.users)
  roles: Role[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}

