import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

// One row per organization, created lazily on first read/write — most
// organizations will never touch these beyond the defaults, so there's no
// seed step for it (unlike Permission, which every role needs upfront).
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(organizationId: string) {
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  async update(organizationId: string, actorId: string, dto: UpdateSettingsDto) {
    const before = await this.get(organizationId);

    const settings = await this.prisma.organizationSettings.update({
      where: { organizationId },
      data: { ...dto, updatedById: actorId },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'settings.updated',
      resource: 'organization_settings',
      resourceId: settings.id,
      beforeState: before,
      afterState: settings,
    });

    return settings;
  }
}
