import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';
import { User } from '../../users/entities/user.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Issue, (issue) => issue.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'issue_id' })
  issue: Issue;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;

  @Column({ length: 255 })
  filename: string;

  @Column({ length: 255 })
  originalFilename: string;

  @Column({ length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number; // File size in bytes

  @Column({ type: 'varchar', length: 500, nullable: true })
  filePath: string | null; // Legacy local path

  @Column({
    name: 'storage_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  storageProvider: string | null; // e.g. do_spaces, local

  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}


