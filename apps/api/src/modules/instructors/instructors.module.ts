import { Module } from '@nestjs/common';
import { InstructorsController } from './instructors.controller.js';
import { InstructorsService } from './instructors.service.js';

@Module({
  controllers: [InstructorsController],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
