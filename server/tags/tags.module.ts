import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AppConfigModule } from '../config/config.module.js';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
