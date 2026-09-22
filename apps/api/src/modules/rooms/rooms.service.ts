import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateRoomDto } from './dto/create-room.dto.js';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.room.findMany({
      where: { branch: { organizationId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateRoomDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const room = await this.prisma.room.create({
      data: { branchId: dto.branchId, name: dto.name, capacity: dto.capacity },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'room.created',
      resource: 'room',
      resourceId: room.id,
      afterState: room,
    });

    return room;
  }
}
