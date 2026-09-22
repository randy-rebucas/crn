import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import type { CreateSuccessStoryDto } from './dto/create-success-story.dto.js';
import type { CreateFaqItemDto } from './dto/create-faq-item.dto.js';

// Same pipeline as curriculum content (curriculum.service.ts) and the
// question bank (questions.service.ts) — kept as its own copy rather than a
// shared import since each of those already documents this independently
// and the transitions themselves never vary.
const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: [ContentStatus.REVIEW],
  REVIEW: [ContentStatus.APPROVED, ContentStatus.DRAFT],
  APPROVED: [ContentStatus.PUBLISHED, ContentStatus.REVIEW],
  PUBLISHED: [ContentStatus.ARCHIVED],
  ARCHIVED: [],
};

type ContentKind = 'announcement' | 'success-story' | 'faq';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Announcements ---------------------------------------------------

  findAnnouncements(organizationId: string) {
    return this.prisma.announcement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnnouncement(organizationId: string, actorId: string, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: { organizationId, authorId: actorId, title: dto.title, body: dto.body },
    });
    await this.audit.log({
      organizationId,
      actorId,
      action: 'announcement.created',
      resource: 'announcement',
      resourceId: announcement.id,
      afterState: announcement,
    });
    return announcement;
  }

  setAnnouncementStatus(organizationId: string, actorId: string, id: string, status: ContentStatus) {
    return this.transition('announcement', organizationId, actorId, id, status);
  }

  // --- Success stories ---------------------------------------------------

  findSuccessStories(organizationId: string) {
    return this.prisma.successStory.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSuccessStory(organizationId: string, actorId: string, dto: CreateSuccessStoryDto) {
    const story = await this.prisma.successStory.create({
      data: {
        organizationId,
        graduateName: dto.graduateName,
        programName: dto.programName,
        year: dto.year,
        testimonial: dto.testimonial,
        photoUrl: dto.photoUrl,
      },
    });
    await this.audit.log({
      organizationId,
      actorId,
      action: 'success_story.created',
      resource: 'success_story',
      resourceId: story.id,
      afterState: story,
    });
    return story;
  }

  setSuccessStoryStatus(organizationId: string, actorId: string, id: string, status: ContentStatus) {
    return this.transition('success-story', organizationId, actorId, id, status);
  }

  // --- FAQ ---------------------------------------------------

  findFaqItems(organizationId: string) {
    return this.prisma.faqItem.findMany({
      where: { organizationId },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createFaqItem(organizationId: string, actorId: string, dto: CreateFaqItemDto) {
    const item = await this.prisma.faqItem.create({
      data: { organizationId, question: dto.question, answer: dto.answer, position: dto.position ?? 0 },
    });
    await this.audit.log({
      organizationId,
      actorId,
      action: 'faq_item.created',
      resource: 'faq_item',
      resourceId: item.id,
      afterState: item,
    });
    return item;
  }

  setFaqItemStatus(organizationId: string, actorId: string, id: string, status: ContentStatus) {
    return this.transition('faq', organizationId, actorId, id, status);
  }

  // --- Shared status pipeline --------------------------------------------

  private async transition(
    kind: ContentKind,
    organizationId: string,
    actorId: string,
    id: string,
    nextStatus: ContentStatus,
  ) {
    const delegate =
      kind === 'announcement'
        ? this.prisma.announcement
        : kind === 'success-story'
          ? this.prisma.successStory
          : this.prisma.faqItem;

    const existing = await (delegate as any).findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException(`${kind} not found`);

    const allowed = ALLOWED_TRANSITIONS[existing.status as ContentStatus];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move ${kind} from ${existing.status} to ${nextStatus}`);
    }

    const updated = await (delegate as any).update({ where: { id }, data: { status: nextStatus } });

    await this.audit.log({
      organizationId,
      actorId,
      action: `${kind.replace('-', '_')}.${nextStatus.toLowerCase()}`,
      resource: kind,
      resourceId: id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status },
    });

    return updated;
  }
}
