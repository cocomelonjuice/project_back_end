import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { Workflow } from './entities/workflow.entity';
import { WorkflowTransition } from './entities/workflow-transition.entity';
import { Project } from '../projects/entities/project.entity';
import { Status } from '../statuses/entities/status.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, WorkflowTransition, Project, Status]),
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}


