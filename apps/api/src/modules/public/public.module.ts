import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [LeadsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
