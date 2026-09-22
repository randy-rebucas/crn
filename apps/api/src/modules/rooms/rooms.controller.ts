import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';

@Controller('v1/rooms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @RequirePermissions('rooms.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.rooms.findAllForOrganization(user.organizationId);
  }

  @Post()
  @RequirePermissions('rooms.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(user.organizationId, user.id, dto);
  }
}
