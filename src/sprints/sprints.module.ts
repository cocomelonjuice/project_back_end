import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SprintsService } from './sprints.service';
import { SprintsController } from './sprints.controller';
import { Sprint } from './entities/sprint.entity';
import { Board } from '../boards/entities/board.entity';
import { Issue } from '../issues/entities/issue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sprint, Board, Issue])],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
