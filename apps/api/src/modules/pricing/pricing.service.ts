import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreatePricingDto } from './dto/create-pricing.dto.js';
import { readOrgSettings } from '../settings/org-settings.js';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForProgram(organizationId: string, programId: string) {
    return this.prisma.pricing.findMany({
      // `programId` omitted = every program's price history (Finance > Pricing).
      where: { programId, program: { organizationId } },
      include: { program: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveForProgram(organizationId: string, programId: string) {
    const pricing = await this.prisma.pricing.findFirst({
      where: { programId, program: { organizationId }, isActive: true },
    });
    if (!pricing) throw new NotFoundException('No active pricing for this program');
    return pricing;
  }

  // Only one price is active per program at a time; setting a new one
  // supersedes the previous, which is kept for historical invoices.
  async create(organizationId: string, actorId: string, dto: CreatePricingDto) {
    const program = await this.prisma.program.findFirst({
      where: { id: dto.programId, organizationId },
    });
    if (!program) throw new NotFoundException('Program not found');

    const { defaultCurrency } = await readOrgSettings(this.prisma, organizationId);

    const pricing = await this.prisma.$transaction(async (tx) => {
      await tx.pricing.updateMany({
        where: { programId: dto.programId, isActive: true },
        data: { isActive: false },
      });

      return tx.pricing.create({
        data: {
          programId: dto.programId,
          amount: dto.amount,
          currency: dto.currency ?? defaultCurrency,
        },
      });
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'pricing.created',
      resource: 'pricing',
      resourceId: pricing.id,
      afterState: pricing,
    });

    return pricing;
  }
}
