import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.organization.findMany();
  }

  findOne(id: string) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id } });
  }

  create(data: { name: string; slug: string }) {
    return this.prisma.organization.create({ data });
  }
}
