import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateBatchDto } from './dto/create-batch.dto.js';

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.batch.findMany({
      where: { program: { organizationId } },
      include: { program: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateBatchDto) {
    const program = await this.prisma.program.findFirst({
      where: { id: dto.programId, organizationId },
    });
    if (!program) throw new NotFoundException('Program not found');

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const batch = await this.prisma.batch.create({
      data: {
        programId: dto.programId,
        branchId: dto.branchId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'batch.created',
      resource: 'batch',
      resourceId: batch.id,
      afterState: batch,
    });

    return batch;
  }
}
