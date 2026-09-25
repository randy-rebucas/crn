import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { UpdateBranchDto } from './dto/update-branch.dto.js';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // `_count` gives the Branches page its per-location headcounts in the same
  // query instead of one request per branch; other callers just ignore it.
  findAllForOrganization(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            studentProfiles: true,
            instructorProfiles: true,
            staffProfiles: true,
            enrollments: true,
            rooms: true,
            classes: true,
          },
        },
      },
    });
  }

  async create(organizationId: string, data: { name: string; code: string; address?: string }) {
    // Codes are unique per organization (@@unique([organizationId, code])) —
    // surface that as a readable 409 instead of a raw constraint error.
    const existing = await this.prisma.branch.findUnique({
      where: { organizationId_code: { organizationId, code: data.code } },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`A branch with code "${data.code}" already exists.`);
    return this.prisma.branch.create({ data: { ...data, organizationId } });
  }

  async update(organizationId: string, actorId: string, id: string, dto: UpdateBranchDto) {
    const before = await this.prisma.branch.findFirst({ where: { id, organizationId } });
    if (!before) throw new NotFoundException('Branch not found');

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'branch.updated',
      resource: 'branch',
      resourceId: id,
      beforeState: before,
      afterState: branch,
    });

    return branch;
  }
}
