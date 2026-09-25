import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreateScheduleDto } from './dto/create-schedule.dto.js';

function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  // "HH:MM" strings compare correctly lexicographically.
  return aStart < bEnd && bStart < aEnd;
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // The caller's own timetable: every non-cancelled class in a batch they're
  // enrolled in, with its weekly meetings. Resolved from the caller's
  // student profile, never from input, so it needs no view permission of
  // its own (students hold neither classes.view nor schedules.view).
  async findMine(organizationId: string, userId: string) {
    const student = await this.prisma.studentProfile.findFirst({ where: { userId, organizationId } });
    if (!student) return [];
    return this.prisma.class.findMany({
      where: {
        status: { not: 'CANCELLED' },
        branch: { organizationId },
        batch: { enrollments: { some: { studentId: student.id } } },
      },
      select: {
        id: true,
        name: true,
        batchId: true,
        status: true,
        course: { select: { id: true, code: true, name: true } },
        room: { select: { name: true } },
        instructor: { select: { user: { select: { firstName: true, lastName: true } } } },
        schedules: {
          select: { id: true, classId: true, dayOfWeek: true, startTime: true, endTime: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  findAllForClass(organizationId: string, classId: string) {
    return this.prisma.schedule.findMany({
      where: { classId, class: { branch: { organizationId } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(organizationId: string, actorId: string, dto: CreateScheduleDto) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const cls = await this.prisma.class.findFirst({
      where: { id: dto.classId, branch: { organizationId } },
    });
    if (!cls) throw new NotFoundException('Class not found');

    // Prevent room and instructor conflicts (blueprint Section 19: Scheduling).
    const sameDayOrgSchedules = await this.prisma.schedule.findMany({
      where: {
        dayOfWeek: dto.dayOfWeek,
        classId: { not: dto.classId },
        class: {
          branch: { organizationId },
          OR: [
            cls.roomId ? { roomId: cls.roomId } : undefined,
            cls.instructorProfileId ? { instructorProfileId: cls.instructorProfileId } : undefined,
          ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
        },
      },
      include: { class: true },
    });

    for (const existing of sameDayOrgSchedules) {
      if (!timeRangesOverlap(dto.startTime, dto.endTime, existing.startTime, existing.endTime)) {
        continue;
      }
      if (cls.roomId && existing.class.roomId === cls.roomId) {
        throw new BadRequestException(
          `Room conflict: room is already booked ${existing.startTime}-${existing.endTime} on this day`,
        );
      }
      if (cls.instructorProfileId && existing.class.instructorProfileId === cls.instructorProfileId) {
        throw new BadRequestException(
          `Instructor conflict: instructor is already booked ${existing.startTime}-${existing.endTime} on this day`,
        );
      }
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        classId: dto.classId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    await this.audit.log({
      organizationId,
      actorId,
      action: 'schedule.created',
      resource: 'schedule',
      resourceId: schedule.id,
      afterState: schedule,
    });

    return schedule;
  }
}
