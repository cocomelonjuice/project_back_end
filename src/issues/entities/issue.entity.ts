import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { IssueType } from '../../issue-types/entities/issue-type.entity';
import { Priority } from '../../priorities/entities/priority.entity';
import { Status } from '../../statuses/entities/status.entity';
import { User } from '../../users/entities/user.entity';
import { Sprint } from '../../sprints/entities/sprint.entity';
import { Comment } from '../../comments/entities/comment.entity';
import { Attachment } from '../../attachments/entities/attachment.entity';
import { Label } from '../../labels/entities/label.entity';

@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  summary: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => Project, (project) => project.issues, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Sprint, (sprint) => sprint.issues, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sprint_id' })
  sprint?: Sprint | null;

  @ManyToOne(() => IssueType, (type) => type.issues, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'type_id' })
  type?: IssueType | null;

  @ManyToOne(() => Priority, (priority) => priority.issues, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'priority_id' })
  priority?: Priority | null;

  @ManyToOne(() => Status, (status) => status.issues, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'status_id' })
  status?: Status | null;

  @ManyToOne(() => User, (user) => user.assignedIssues, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assignee_id' })
  assignee?: User | null;

  @ManyToOne(() => User, (user) => user.reportedIssues, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: User | null;

  @ManyToOne(() => Issue, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_issue_id' })
  parent?: Issue | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Comment, (comment) => comment.issue)
  comments: Comment[];

  @OneToMany(() => Attachment, (attachment) => attachment.issue)
  attachments: Attachment[];

  @ManyToMany(() => Label, (label) => label.issues)
  labels: Label[];
}

