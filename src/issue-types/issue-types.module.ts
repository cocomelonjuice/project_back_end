import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueType } from './entities/issue-type.entity';
import { IssueTypesService } from './issue-types.service';
import { IssueTypesController } from './issue-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IssueType])],
  controllers: [IssueTypesController],
  providers: [IssueTypesService],
  exports: [IssueTypesService],
})
export class IssueTypesModule {}
