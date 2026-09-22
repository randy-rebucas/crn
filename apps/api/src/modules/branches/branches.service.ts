import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForOrganization(organizationId: string) {
    return this.prisma.branch.findMany({ where: { organizationId } });
  }

  create(organizationId: string, data: { name: string; code: string; address?: string }) {
    return this.prisma.branch.create({ data: { ...data, organizationId } });
  }
}
