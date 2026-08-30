import { Module } from '@nestjs/common';
import { CatalogerController } from './cataloger.controller.js';
import { CatalogerClientService } from './cataloger.service.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [MediaModule],
  controllers: [CatalogerController],
  providers: [CatalogerClientService],
  exports: [CatalogerClientService],
})
export class CatalogerClientModule {}
