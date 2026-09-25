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

  private async row(organizationId: string) {
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  // The organization's display name lives on Organization, not the settings
  // row, but it's edited from the same screen — return both together.
  async get(organizationId: string) {
    const [settings, organization] = await Promise.all([
      this.row(organizationId),
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } }),
    ]);
    return { ...settings, organizationName: organization.name };
  }

  async update(organizationId: string, actorId: string, dto: UpdateSettingsDto) {
    const before = await this.get(organizationId);
    const { organizationName, ...settingsData } = dto;

    const [settings] = await this.prisma.$transaction([
      this.prisma.organizationSettings.update({
        where: { organizationId },
        data: {
          ...settingsData,
          additionalPhones: settingsData.additionalPhones?.map((p) => p.trim()).filter(Boolean),
          updatedById: actorId,
        },
      }),
      ...(organizationName
        ? [this.prisma.organization.update({ where: { id: organizationId }, data: { name: organizationName.trim() } })]
        : []),
    ]);

    const after = { ...settings, organizationName: organizationName?.trim() ?? before.organizationName };

    await this.audit.log({
      organizationId,
      actorId,
      action: 'settings.updated',
      resource: 'organization_settings',
      resourceId: settings.id,
      beforeState: before,
      afterState: after,
    });

    return after;
  }
}
