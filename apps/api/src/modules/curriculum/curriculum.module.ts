import { Module } from '@nestjs/common';
import { ModulesController, LessonsController, MaterialsController } from './curriculum.controller.js';
import { CurriculumService } from './curriculum.service.js';

@Module({
  controllers: [ModulesController, LessonsController, MaterialsController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
