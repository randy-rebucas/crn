import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { LeadsService } from './leads.service.js';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto.js';
import { AddFollowUpDto } from './dto/add-follow-up.dto.js';

@Controller('v1/leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions('leads.view')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: LeadStatus) {
    return this.leads.findAllForOrganization(user.organizationId, status);
  }

  @Get(':id')
  @RequirePermissions('leads.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.leads.findOne(user.organizationId, id);
  }

  @Post()
  @RequirePermissions('leads.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user.organizationId, user.id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('leads.update')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leads.setStatus(user.organizationId, user.id, id, dto.status);
  }

  @Post(':id/follow-ups')
  @RequirePermissions('leads.update')
  addFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddFollowUpDto,
  ) {
    return this.leads.addFollowUp(user.organizationId, user.id, id, dto);
  }
}
