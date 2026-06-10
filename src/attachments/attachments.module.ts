import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { Attachment } from './entities/attachment.entity';
import { Issue } from '../issues/entities/issue.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment, Issue, User]),
    forwardRef(() => NotificationsModule),
    StorageModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
