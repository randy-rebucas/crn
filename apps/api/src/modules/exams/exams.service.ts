import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publishedOnlyWhere } from '../../common/authz/content-visibility.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CreateExamDto } from './dto/create-exam.dto.js';
import type { AddExamQuestionDto } from './dto/add-exam-question.dto.js';

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForOrganization(user: AuthenticatedUser) {
    return this.prisma.exam.findMany({
      where: { organizationId: user.organizationId, ...publishedOnlyWhere(user, 'exams.create') },
      // Counts + program name let the exam list show readiness without a
      // detail request per row.
      include: {
        program: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // `user` omitted = internal/already-gated caller (e.g. `publish` below)
  // that needs the exam regardless of its current status.
  //
  // Nested questions always include the full `Question` row, including
  // `correctAnswer`/`explanation` — this endpoint is gated only by
  // `exams.view`, which a student-facing role also holds (to list exams
  // before starting an attempt), so a non-authoring caller must never
  // receive the answer key here. Same leak class as the question-bank
  // endpoint, different route.
  async findOne(organizationId: string, id: string, user?: AuthenticatedUser) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        id,
        organizationId,
        ...(user ? publishedOnlyWhere(user, 'exams.create') : {}),
      },
      include: { questions: { include: { question: true }, orderBy: { position: 'asc' } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const canSeeAnswers = user
      ? user.permissions.some((p) => p.key === 'exams.approve' || p.key === 'exams.create')
      : true;
    if (canSeeAnswers) return exam;

    return {
      ...exam,
      questions: exam.questions.map((eq) => ({
        ...eq,
        question: { ...eq.question, correctAnswer: undefined, explanation: null },
      })),
    };
  }

  async create(organizationId: string, actorId: string, dto: CreateExamDto) {
    if (dto.programId) {
      const program = await this.prisma.program.findFirst({
        where: { id: dto.programId, organizationId },
      });
      if (!program) throw new NotFoundException('Program not found');
    }

    const exam = await this.prisma.exam.create({
      data: {
        organizationId,
        programId: dto.programId,
        title: dto.title,
        type: dto.type,
        timeLimitMinutes: dto.timeLimitMinutes,
        passingScore: dto.passingScore,
        attemptLimit: dto.attemptLimit ?? 1,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        shuffleOptions: dto.shuffleOptions ?? false,
        resultRelease: dto.resultRelease,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'exam.created',
      resource: 'exam',
      resourceId: exam.id,
      afterState: exam,
    });

    return exam;
  }

  async addQuestion(organizationId: string, actorId: string, examId: string, dto: AddExamQuestionDto) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, organizationId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.status === ContentStatus.PUBLISHED) {
      throw new BadRequestException('Cannot add questions to a published exam');
    }

    const question = await this.prisma.question.findFirst({
      where: { id: dto.questionId, subject: { course: { program: { organizationId } } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.status !== ContentStatus.APPROVED && question.status !== ContentStatus.PUBLISHED) {
      // Blueprint Section 14: exams draw only from reviewed/approved question-bank entries.
      throw new BadRequestException('Only approved questions can be added to an exam');
    }

    const alreadyAdded = await this.prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId, questionId: dto.questionId } },
      select: { id: true },
    });
    if (alreadyAdded) throw new ConflictException('That question is already on this exam');

    const examQuestion = await this.prisma.examQuestion.create({
      data: {
        examId,
        questionId: dto.questionId,
        points: dto.points ?? 1,
        position: dto.position ?? 0,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'exam.question_added',
      resource: 'exam',
      resourceId: examId,
      afterState: examQuestion,
    });

    return examQuestion;
  }

  // Draft-only, same rule as addQuestion: a published exam's question set is
  // frozen because attempts are scored against it.
  async removeQuestion(organizationId: string, actorId: string, examId: string, examQuestionId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, organizationId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.status === ContentStatus.PUBLISHED) {
      throw new BadRequestException('Cannot remove questions from a published exam');
    }

    const examQuestion = await this.prisma.examQuestion.findFirst({ where: { id: examQuestionId, examId } });
    if (!examQuestion) throw new NotFoundException('Question is not on this exam');

    await this.prisma.examQuestion.delete({ where: { id: examQuestion.id } });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'exam.question_removed',
      resource: 'exam',
      resourceId: examId,
      beforeState: examQuestion,
    });

    return { id: examQuestion.id };
  }

  async publish(organizationId: string, actorId: string, id: string) {
    const exam = await this.findOne(organizationId, id);
    if (exam.questions.length === 0) {
      throw new BadRequestException('Cannot publish an exam with no questions');
    }

    const updated = await this.prisma.exam.update({
      where: { id },
      data: { status: ContentStatus.PUBLISHED },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'exam.published',
      resource: 'exam',
      resourceId: id,
      beforeState: { status: exam.status },
      afterState: { status: updated.status },
    });

    return updated;
  }
}
