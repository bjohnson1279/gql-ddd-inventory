import { NotificationInboxService } from '../../domain/notification/NotificationServices';
import { Notification } from '../../domain/notification/NotificationEntities';

// Mock instance
const inboxService = new NotificationInboxService([]);

export const notificationResolvers = {
  Query: {
    unreadNotificationCount: (_: any, args: { userId: string }) => {
      return inboxService.getUnreadCount(args.userId);
    }
  },
  Mutation: {
    markNotificationRead: (_: any, args: { notificationId: string, userId: string }) => {
      return inboxService.markAsRead(args.notificationId, args.userId);
    },
    snoozeNotification: (_: any, args: { notificationId: string, userId: string, hours: number }) => {
      return inboxService.snooze(args.notificationId, args.userId, args.hours);
    },
    escalateNotification: (_: any, args: { notificationId: string, userId: string, targetManagerId: string }) => {
      return inboxService.escalate(args.notificationId, args.userId, args.targetManagerId);
    }
  },
  Notification: {
    createdAt: (parent: Notification) => parent.createdAt.toISOString(),
    snoozedUntil: (parent: Notification) => parent.snoozedUntil ? parent.snoozedUntil.toISOString() : null,
  }
};
