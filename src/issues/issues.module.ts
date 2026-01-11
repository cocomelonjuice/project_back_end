import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { Issue } from './entities/issue.entity';
import { Project } from '../projects/entities/project.entity';
import { IssueType } from '../issue-types/entities/issue-type.entity';
import { Priority } from '../priorities/entities/priority.entity';
import { Status } from '../statuses/entities/status.entity';
import { User } from '../users/entities/user.entity';
import { Sprint } from '../sprints/entities/sprint.entity';
import { Label } from '../labels/entities/label.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Issue,
      Project,
      IssueType,
      Priority,
      Status,
      User,
      Sprint,
      Label,
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}




