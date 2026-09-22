import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ContentService } from './content.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { CreateSuccessStoryDto } from './dto/create-success-story.dto.js';
import { CreateFaqItemDto } from './dto/create-faq-item.dto.js';
import { SetContentStatusDto } from './dto/set-content-status.dto.js';

@Controller('v1/content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // --- Announcements ---------------------------------------------------

  @Get('announcements')
  @RequirePermissions('content.view')
  findAnnouncements(@CurrentUser() user: AuthenticatedUser) {
    return this.content.findAnnouncements(user.organizationId);
  }

  @Post('announcements')
  @RequirePermissions('content.manage')
  createAnnouncement(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAnnouncementDto) {
    return this.content.createAnnouncement(user.organizationId, user.id, dto);
  }

  @Patch('announcements/:id/status')
  @RequirePermissions('content.manage')
  setAnnouncementStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetContentStatusDto,
  ) {
    return this.content.setAnnouncementStatus(user.organizationId, user.id, id, dto.status);
  }

  // --- Success stories ---------------------------------------------------

  @Get('success-stories')
  @RequirePermissions('content.view')
  findSuccessStories(@CurrentUser() user: AuthenticatedUser) {
    return this.content.findSuccessStories(user.organizationId);
  }

  @Post('success-stories')
  @RequirePermissions('content.manage')
  createSuccessStory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSuccessStoryDto) {
    return this.content.createSuccessStory(user.organizationId, user.id, dto);
  }

  @Patch('success-stories/:id/status')
  @RequirePermissions('content.manage')
  setSuccessStoryStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetContentStatusDto,
  ) {
    return this.content.setSuccessStoryStatus(user.organizationId, user.id, id, dto.status);
  }

  // --- FAQ ---------------------------------------------------

  @Get('faq')
  @RequirePermissions('content.view')
  findFaqItems(@CurrentUser() user: AuthenticatedUser) {
    return this.content.findFaqItems(user.organizationId);
  }

  @Post('faq')
  @RequirePermissions('content.manage')
  createFaqItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFaqItemDto) {
    return this.content.createFaqItem(user.organizationId, user.id, dto);
  }

  @Patch('faq/:id/status')
  @RequirePermissions('content.manage')
  setFaqItemStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetContentStatusDto,
  ) {
    return this.content.setFaqItemStatus(user.organizationId, user.id, id, dto.status);
  }
}
