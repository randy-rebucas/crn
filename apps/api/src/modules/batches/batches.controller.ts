import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { BatchesService } from './batches.service.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';

@Controller('v1/batches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  @RequirePermissions('batches.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.batches.findAllForOrganization(user.organizationId);
  }

  @Post()
  @RequirePermissions('batches.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBatchDto) {
    return this.batches.create(user.organizationId, user.id, dto);
  }
}
