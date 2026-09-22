import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';

@Module({
  imports: [InvoicesModule],
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
