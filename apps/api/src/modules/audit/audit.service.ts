import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuditEntry {
  // Required, not optional: every caller must know which organization an
  // audited action belongs to (see the schema comment on AuditLog for why).
  organizationId: string;
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string;
}

/**
 * Append-only audit trail. There is intentionally no update/delete here —
 * audit rows must never be mutated by application code.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        actorId: entry.actorId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        beforeState: entry.beforeState as never,
        afterState: entry.afterState as never,
        reason: entry.reason,
      },
    });
  }
}
