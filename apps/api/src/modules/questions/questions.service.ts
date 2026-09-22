import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateQuestionDto } from './dto/create-question.dto.js';

// Anyone without `exams.approve` (a reviewer/author of the question bank)
// must never receive `correctAnswer`/`explanation` in the response body —
// this endpoint was previously gated only by `exams.view`, which a
// student-facing role also holds to list exams, so it leaked every
// question's answer key directly, bypassing the exam-attempt flow
// entirely. Approved/published-only status filtering alone wasn't enough:
// even an approved question's answer must stay hidden from a non-author
// caller browsing the bank outside of an actual attempt.
function canSeeAnswers(user: AuthenticatedUser) {
  return user.permissions.some((p) => p.key === 'exams.approve' || p.key === 'exams.create');
}

function redactAnswers<T extends { correctAnswer: unknown; explanation: string | null }>(
  question: T,
  user: AuthenticatedUser,
): T {
  if (canSeeAnswers(user)) return question;
  return { ...question, correctAnswer: undefined, explanation: null };
}

// Question status pipeline (blueprint Section 14): a question is authored,
// reviewed, and approved before an exam is allowed to draw from it.
const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: [ContentStatus.REVIEW],
  REVIEW: [ContentStatus.APPROVED, ContentStatus.DRAFT],
  APPROVED: [ContentStatus.PUBLISHED, ContentStatus.REVIEW],
  PUBLISHED: [ContentStatus.ARCHIVED],
  ARCHIVED: [],
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAllForSubject(user: AuthenticatedUser, subjectId: string, status?: ContentStatus) {
    const canManage = canSeeAnswers(user);
    const questions = await this.prisma.question.findMany({
      where: {
        subjectId,
        subject: { course: { program: { organizationId: user.organizationId } } },
        // A non-author caller only ever gets to browse APPROVED/PUBLISHED
        // questions, and only within that set may they further narrow by
        // `status` (there's nothing else for them to see).
        ...(canManage
          ? status
            ? { status }
            : {}
          : { status: status && ['APPROVED', 'PUBLISHED'].includes(status) ? status : { in: [ContentStatus.APPROVED, ContentStatus.PUBLISHED] } }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return questions.map((q) => redactAnswers(q, user));
  }

  // `user` omitted = internal/already-gated caller (e.g. exam authoring
  // flows that legitimately need the answer key) reading regardless of
  // status/redaction.
  async findOne(organizationId: string, id: string, user?: AuthenticatedUser) {
    const question = await this.prisma.question.findFirst({
      where: { id, subject: { course: { program: { organizationId } } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    return user ? redactAnswers(question, user) : question;
  }

  async create(organizationId: string, actorId: string, dto: CreateQuestionDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, course: { program: { organizationId } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const question = await this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        authorId: actorId,
        type: dto.type,
        difficulty: dto.difficulty,
        topic: dto.topic,
        tags: dto.tags ?? [],
        content: dto.content,
        options: dto.options,
        correctAnswer: dto.correctAnswer as any,
        explanation: dto.explanation,
        reference: dto.reference,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'question.created',
      resource: 'question',
      resourceId: question.id,
      afterState: question,
    });

    return question;
  }

  async review(organizationId: string, actorId: string, id: string, nextStatus: ContentStatus) {
    const question = await this.findOne(organizationId, id);

    const allowed = ALLOWED_TRANSITIONS[question.status];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move question from ${question.status} to ${nextStatus}`);
    }

    const isApprovalStep = nextStatus === ContentStatus.APPROVED;

    const updated = await this.prisma.question.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewerId: isApprovalStep ? actorId : question.reviewerId,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: `question.${nextStatus.toLowerCase()}`,
      resource: 'question',
      resourceId: id,
      beforeState: { status: question.status },
      afterState: { status: updated.status },
    });

    return updated;
  }
}
