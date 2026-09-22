import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateLeadDto } from './dto/create-lead.dto.js';
import type { AddFollowUpDto } from './dto/add-follow-up.dto.js';
import { LEAD_TRANSITIONS } from './lead-transitions.js';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(organizationId: string, status?: LeadStatus) {
    return this.prisma.lead.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        followUps: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(organizationId: string, actorId: string | undefined, dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        branchId: dto.branchId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        programInterest: dto.programInterest,
        source: dto.source,
        message: dto.message,
        assignedToId: dto.assignedToId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'lead.created',
      resource: 'lead',
      resourceId: lead.id,
      afterState: lead,
    });

    return lead;
  }

  async setStatus(organizationId: string, actorId: string, id: string, nextStatus: LeadStatus) {
    const lead = await this.findOne(organizationId, id);

    const allowed = LEAD_TRANSITIONS[lead.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move lead from ${lead.status} to ${nextStatus}`);
    }

    const updated = await this.prisma.lead.update({ where: { id }, data: { status: nextStatus } });

    await this.audit.log({
      organizationId,
      actorId,
      action: `lead.${nextStatus.toLowerCase()}`,
      resource: 'lead',
      resourceId: id,
      beforeState: { status: lead.status },
      afterState: { status: updated.status },
    });

    return updated;
  }

  async addFollowUp(organizationId: string, actorId: string, leadId: string, dto: AddFollowUpDto) {
    await this.findOne(organizationId, leadId);

    const followUp = await this.prisma.leadFollowUp.create({
      data: {
        leadId,
        note: dto.note,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdById: actorId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'lead.follow_up_added',
      resource: 'lead',
      resourceId: leadId,
      afterState: followUp,
    });

    return followUp;
  }
}
