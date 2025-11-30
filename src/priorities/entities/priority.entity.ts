import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Issue } from '../../issues/entities/issue.entity';

@Entity('priorities')
export class Priority {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'order_num', type: 'int' })
  orderNum: number;

  @OneToMany(() => Issue, (issue) => issue.priority)
  issues: Issue[];
}

