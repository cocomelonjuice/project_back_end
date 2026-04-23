import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpacesService } from './spaces.service';

@Module({
  imports: [ConfigModule],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class StorageModule {}
