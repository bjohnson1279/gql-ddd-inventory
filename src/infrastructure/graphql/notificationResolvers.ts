import { NotificationInboxService } from '../../domain/notification/NotificationServices';
import { Notification } from '../../domain/notification/NotificationEntities';

// Mock instance
export const notificationInboxService = new NotificationInboxService([]);

function getNotificationAuth(context: any): { userId?: string; tenantId: string } {
  const auth = context?.auth;
  if (!auth) {
    throw new Error('Authentication required: Access token is missing or invalid.');
  }
  const tenantId = auth.tenantId;
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant identification missing from context.');
  }
  const userId = auth.userId || auth.actorId;
  return { userId, tenantId };
}

export const notificationResolvers = {
  Query: {
    unreadNotificationCount: (_: any, args: { userId: string }, context: any) => {
      const { tenantId } = getNotificationAuth(context);
      let count = 0;
      for (const n of notificationInboxService.notifications) {
        if (n.tenantId === tenantId && n.userId === args.userId && n.status === 'UNREAD') {
          count++;
        }
      }
      return count;
    }
  },
  Mutation: {
    markNotificationRead: (_: any, args: { notificationId: string, userId: string }, context: any) => {
      const { tenantId } = getNotificationAuth(context);
      const notif = notificationInboxService.notifications.find(
        n => n.id === args.notificationId && n.userId === args.userId && n.tenantId === tenantId
      );
      if (!notif) throw new Error('Notification not found or access denied');
      return notificationInboxService.markAsRead(args.notificationId, args.userId);
    },
    snoozeNotification: (_: any, args: { notificationId: string, userId: string, hours: number }, context: any) => {
      const { tenantId } = getNotificationAuth(context);
      const notif = notificationInboxService.notifications.find(
        n => n.id === args.notificationId && n.userId === args.userId && n.tenantId === tenantId
      );
      if (!notif) throw new Error('Notification not found or access denied');
      return notificationInboxService.snooze(args.notificationId, args.userId, args.hours);
    },
    escalateNotification: (_: any, args: { notificationId: string, userId: string, targetManagerId: string }, context: any) => {
      const { tenantId } = getNotificationAuth(context);
      const notif = notificationInboxService.notifications.find(
        n => n.id === args.notificationId && n.userId === args.userId && n.tenantId === tenantId
      );
      if (!notif) throw new Error('Notification not found or access denied');
      return notificationInboxService.escalate(args.notificationId, args.userId, args.targetManagerId);
    }
  },
  Notification: {
    createdAt: (parent: Notification) => parent.createdAt.toISOString(),
    snoozedUntil: (parent: Notification) => parent.snoozedUntil ? parent.snoozedUntil.toISOString() : null,
  }
};
