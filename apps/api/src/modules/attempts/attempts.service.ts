import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttemptStatus, ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { gradeResponse } from './grading.js';
import type { SubmitAttemptDto } from './dto/submit-attempt.dto.js';

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async requireStudentProfile(organizationId: string, userId: string) {
    const student = await this.prisma.studentProfile.findFirst({ where: { userId, organizationId } });
    if (!student) throw new NotFoundException('No student profile for this account');
    return student;
  }

  findAllForExam(organizationId: string, examId: string) {
    return this.prisma.attempt.findMany({
      where: { examId, exam: { organizationId } },
      include: { student: { select: { id: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  // "My attempts across every exam" — previously didn't exist, so the
  // student UI had no way to show attempt history except a per-device
  // localStorage cache. Applies the same delayed-release redaction as
  // `findResultForStudent` per attempt, since this list mixes attempts
  // whose exams may have different release policies.
  async findAllForCurrentStudent(organizationId: string, userId: string) {
    const student = await this.requireStudentProfile(organizationId, userId);

    const attempts = await this.prisma.attempt.findMany({
      where: { studentId: student.id, exam: { organizationId } },
      include: { exam: { select: { id: true, title: true, resultRelease: true, passingScore: true } } },
      orderBy: { startedAt: 'desc' },
    });

    return attempts.map((attempt) => {
      if (attempt.exam.resultRelease === 'DELAYED' && attempt.status !== AttemptStatus.GRADED) {
        return {
          id: attempt.id,
          examId: attempt.examId,
          exam: attempt.exam,
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
        };
      }
      return attempt;
    });
  }

  async findOne(organizationId: string, id: string) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id, exam: { organizationId } },
      include: {
        exam: true,
        answers: { include: { question: { select: { id: true, content: true, type: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  // Applies the exam's result-release policy: a student polling their own
  // delayed-release attempt sees status only, never the score or answers,
  // until an instructor has finished grading it (blueprint Section 15).
  async findResultForStudent(organizationId: string, userId: string, id: string) {
    const student = await this.requireStudentProfile(organizationId, userId);
    const attempt = await this.findOne(organizationId, id);
    if (attempt.studentId !== student.id) {
      throw new ForbiddenException('This attempt does not belong to you');
    }

    if (attempt.exam.resultRelease === 'DELAYED' && attempt.status !== AttemptStatus.GRADED) {
      return { id: attempt.id, status: attempt.status, submittedAt: attempt.submittedAt };
    }

    return attempt;
  }

  async start(organizationId: string, userId: string, examId: string) {
    const student = await this.requireStudentProfile(organizationId, userId);

    const exam = await this.prisma.exam.findFirst({ where: { id: examId, organizationId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.status !== ContentStatus.PUBLISHED) {
      throw new BadRequestException('Exam is not published');
    }

    const attemptCount = await this.prisma.attempt.count({
      where: { examId, studentId: student.id },
    });
    if (attemptCount >= exam.attemptLimit) {
      throw new BadRequestException(`Attempt limit (${exam.attemptLimit}) reached for this exam`);
    }

    const attempt = await this.prisma.attempt.create({
      data: { examId, studentId: student.id },
    });

    await this.audit.log({
      organizationId,
      actorId: userId,
      action: 'attempt.started',
      resource: 'attempt',
      resourceId: attempt.id,
      afterState: attempt,
    });

    return attempt;
  }

  async submit(organizationId: string, userId: string, attemptId: string, dto: SubmitAttemptDto) {
    const student = await this.requireStudentProfile(organizationId, userId);

    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, exam: { organizationId } },
      include: { exam: { include: { questions: { include: { question: true } } } } },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== student.id) {
      throw new ForbiddenException('This attempt does not belong to you');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt has already been submitted');
    }

    const examQuestionByQuestionId = new Map(
      attempt.exam.questions.map((eq) => [eq.questionId, eq]),
    );

    let scoreSoFar = 0;
    let anyPendingManualGrade = false;

    for (const answer of dto.answers) {
      const examQuestion = examQuestionByQuestionId.get(answer.questionId);
      if (!examQuestion) continue; // ignore answers for questions not on this exam

      const { isCorrect, needsManualGrading } = gradeResponse(
        examQuestion.question.type,
        examQuestion.question.correctAnswer,
        answer.response,
      );
      const pointsAwarded = isCorrect ? examQuestion.points : needsManualGrading ? null : 0;
      if (needsManualGrading) anyPendingManualGrade = true;
      else scoreSoFar += pointsAwarded ?? 0;

      await this.prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: answer.questionId } },
        update: { response: answer.response as any, isCorrect, pointsAwarded, needsManualGrading },
        create: {
          attemptId,
          questionId: answer.questionId,
          response: answer.response as any,
          isCorrect,
          pointsAwarded,
          needsManualGrading,
        },
      });
    }

    const maxScore = attempt.exam.questions.reduce((sum, eq) => sum + eq.points, 0);

    const updated = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: anyPendingManualGrade
        ? { status: AttemptStatus.SUBMITTED, submittedAt: new Date(), maxScore }
        : {
            status: AttemptStatus.GRADED,
            submittedAt: new Date(),
            gradedAt: new Date(),
            score: scoreSoFar,
            maxScore,
            passed: scoreSoFar >= attempt.exam.passingScore,
          },
    });

    await this.audit.log({
      organizationId,
      actorId: userId,
      action: 'attempt.submitted',
      resource: 'attempt',
      resourceId: attemptId,
      afterState: updated,
    });

    return updated;
  }

  async gradeAnswer(
    organizationId: string,
    actorId: string,
    attemptId: string,
    questionId: string,
    pointsAwarded: number,
  ) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, exam: { organizationId } },
      include: { exam: true, answers: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const answer = attempt.answers.find((a) => a.questionId === questionId);
    if (!answer) throw new NotFoundException('Answer not found for this attempt');
    if (!answer.needsManualGrading) {
      throw new BadRequestException('This answer does not require manual grading');
    }

    await this.prisma.attemptAnswer.update({
      where: { id: answer.id },
      data: { pointsAwarded, needsManualGrading: false, isCorrect: pointsAwarded > 0 },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'attempt.answer_graded',
      resource: 'attempt',
      resourceId: attemptId,
      afterState: { questionId, pointsAwarded },
    });

    const remaining = await this.prisma.attemptAnswer.count({
      where: { attemptId, needsManualGrading: true },
    });

    if (remaining === 0) {
      const allAnswers = await this.prisma.attemptAnswer.findMany({ where: { attemptId } });
      const score = allAnswers.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);

      const finalized = await this.prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.GRADED,
          gradedAt: new Date(),
          score,
          passed: score >= attempt.exam.passingScore,
        },
      });

      await this.audit.log({
        organizationId,
        actorId,
        action: 'attempt.graded',
        resource: 'attempt',
        resourceId: attemptId,
        afterState: { score: finalized.score, passed: finalized.passed },
      });

      return finalized;
    }

    return attempt;
  }
}
