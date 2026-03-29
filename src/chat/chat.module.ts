import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { CommentsModule } from '../comments/comments.module';
import { BoardsModule } from '../boards/boards.module';
import { IssuesModule } from '../issues/issues.module';
import { ProjectsModule } from '../projects/projects.module';
import { SearchModule } from '../search/search.module';
import { SprintsModule } from '../sprints/sprints.module';
import { LabelsModule } from '../labels/labels.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatConversation, ChatMessage]),
    AiModule,
    SearchModule,
    IssuesModule,
    CommentsModule,
    ProjectsModule,
    BoardsModule,
    SprintsModule,
    LabelsModule,
    WorkflowsModule,
    RolesModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
