import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';

@Entity('issue_types')
export class IssueType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => Issue, (issue) => issue.type)
  issues: Issue[];
}
