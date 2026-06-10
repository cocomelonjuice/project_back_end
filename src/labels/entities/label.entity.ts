import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';

@Entity('labels')
export class Label {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  name: string;

  @Column({ length: 7, nullable: true })
  color?: string; // Hex color code (e.g., #FF5733)

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToMany(() => Issue, (issue) => issue.labels)
  issues: Issue[];
}
