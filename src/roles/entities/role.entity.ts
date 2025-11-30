import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  name: string; // e.g., 'admin', 'developer', 'viewer'

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  permissions?: string[]; // Array of permission strings

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @ManyToMany(() => Project, (project) => project.roles)
  projects: Project[];
}


