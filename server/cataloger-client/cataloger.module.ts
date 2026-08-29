import { Module } from '@nestjs/common';
import { CatalogerController } from './cataloger.controller.js';
import { CatalogerClientService } from './cataloger.service.js';

@Module({
  controllers: [CatalogerController],
  providers: [CatalogerClientService],
  exports: [CatalogerClientService],
})
export class CatalogerClientModule {}
