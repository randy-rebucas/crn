import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

// There is no platform-admin role in this system — every caller reaching
// these endpoints is a tenant user, scoped by `organizations.view`/`.create`
// at ORGANIZATION scope within their own tenant. Neither method may ever
// return or touch a different tenant's Organization row.
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.organization.findMany({ where: { id: organizationId } });
  }

  async findOne(organizationId: string, id: string) {
    if (id !== organizationId) throw new NotFoundException('Organization not found');
    return this.prisma.organization.findUniqueOrThrow({ where: { id } });
  }
}
