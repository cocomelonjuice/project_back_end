import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Board } from '../../boards/entities/board.entity';
import { Issue } from '../../issues/entities/issue.entity';

@Entity('sprints')
export class Sprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Board, (board) => board.sprints, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'board_id' })
  board: Board;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  goal?: string;

  @Column({ name: 'start_date', type: 'timestamp with time zone', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'timestamp with time zone', nullable: true })
  endDate?: Date;

  @Column({ length: 20, default: 'planned' })
  status: string; // 'planned', 'active', 'closed'

  @OneToMany(() => Issue, (issue) => issue.sprint)
  issues: Issue[];
}


