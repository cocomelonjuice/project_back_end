import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Workflow } from './workflow.entity';
import { Status } from '../../statuses/entities/status.entity';

@Entity('workflow_transitions')
export class WorkflowTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workflow, (workflow) => workflow.transitions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @ManyToOne(() => Status, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_status_id' })
  fromStatus: Status;

  @ManyToOne(() => Status, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_status_id' })
  toStatus: Status;
}
