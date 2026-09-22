import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [InvoicesModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
