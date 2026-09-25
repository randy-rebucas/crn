import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notificationToggle, readStudentPreferencesByUser } from '../students/student-preferences.js';

export interface NotificationEvent {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
}

// Centralized notification sink (blueprint Section 24): domain modules call
// `emit` on significant events instead of embedding delivery logic
// themselves. In-app only for now; email/push/SMS channels would fan out
// from this same entry point without touching the emitting module.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns null when the recipient is a student who muted this category.
  // Callers already ignore the return value, so a muted event is a no-op.
  async emit(event: NotificationEvent) {
    const toggle = notificationToggle(event.type);
    if (toggle) {
      const prefs = await readStudentPreferencesByUser(this.prisma, event.userId);
      if (prefs && !prefs[toggle]) return null;
    }
    return this.prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        userId: event.userId,
        type: event.type,
        title: event.title,
        body: event.body,
      },
    });
  }

  findAllForUser(userId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) return null;
    if (notification.readAt) return notification;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
}
