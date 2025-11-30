import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';

@Entity('statuses')
export class Status {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 20 })
  category: string;

  @OneToMany(() => Issue, (issue) => issue.status)
  issues: Issue[];
}

