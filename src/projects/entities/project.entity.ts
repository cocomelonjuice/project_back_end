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
import { Board } from '../../boards/entities/board.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  key: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  type: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Issue, (issue) => issue.project)
  issues: Issue[];

  @OneToMany(() => Board, (board) => board.project)
  boards: Board[];

  @ManyToMany(() => Role, (role) => role.projects)
  roles: Role[];
}
