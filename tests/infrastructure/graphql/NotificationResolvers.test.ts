import { notificationResolvers, notificationInboxService } from '../../../src/infrastructure/graphql/notificationResolvers';
import { Notification, NotificationCategory, NotificationSeverity, NotificationStatus } from '../../../src/domain/notification/NotificationEntities';

describe('notificationResolvers', () => {
  const validContext = { auth: { userId: 'user-1', tenantId: 'tenant-1' } };

  beforeEach(() => {
    notificationInboxService.notifications = [
      new Notification('notif-1', 'tenant-1', 'user-1', NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.INFO, 'Low stock item A', {}, NotificationStatus.UNREAD),
      new Notification('notif-2', 'tenant-1', 'user-1', NotificationCategory.SYSTEM_ANOMALY, NotificationSeverity.WARNING, 'Anomaly detected', {}, NotificationStatus.UNREAD),
      new Notification('notif-3', 'tenant-1', 'user-2', NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.INFO, 'Low stock item B', {}, NotificationStatus.UNREAD),
      new Notification('notif-4', 'tenant-2', 'user-1', NotificationCategory.WEBHOOK_FAILURE, NotificationSeverity.CRITICAL, 'Cross-tenant alert', {}, NotificationStatus.UNREAD),
    ];
  });

  describe('Query: unreadNotificationCount', () => {
    it('should return unread notification count filtered by active tenant and target user', () => {
      const count = notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, validContext);
      expect(count).toBe(2);
    });

    it('should throw authentication error when context is missing', () => {
      expect(() => {
        notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, {});
      }).toThrow('Authentication required: Access token is missing or invalid.');
    });

    it('should throw unauthorized error when tenantId is missing from auth', () => {
      expect(() => {
        notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, { auth: { userId: 'user-1' } });
      }).toThrow('Unauthorized: Tenant identification missing from context.');
    });
  });

  describe('Mutation: markNotificationRead', () => {
    it('should mark notification as read for authorized tenant and user', () => {
      const result = notificationResolvers.Mutation.markNotificationRead(null, { notificationId: 'notif-1', userId: 'user-1' }, validContext);
      expect(result).toBe(true);
      const notif = notificationInboxService.notifications.find(n => n.id === 'notif-1');
      expect(notif?.status).toBe(NotificationStatus.READ);
    });

    it('should reject markNotificationRead for notification belonging to another tenant (IDOR prevention)', () => {
      expect(() => {
        notificationResolvers.Mutation.markNotificationRead(null, { notificationId: 'notif-4', userId: 'user-1' }, validContext);
      }).toThrow('Notification not found or access denied');
    });

    it('should reject markNotificationRead for non-existent notification', () => {
      expect(() => {
        notificationResolvers.Mutation.markNotificationRead(null, { notificationId: 'notif-nonexistent', userId: 'user-1' }, validContext);
      }).toThrow('Notification not found or access denied');
    });
  });

  describe('Mutation: snoozeNotification', () => {
    it('should snooze notification for authorized tenant and user', () => {
      const result = notificationResolvers.Mutation.snoozeNotification(null, { notificationId: 'notif-2', userId: 'user-1', hours: 2 }, validContext);
      expect(result).toBe(true);
      const notif = notificationInboxService.notifications.find(n => n.id === 'notif-2');
      expect(notif?.status).toBe(NotificationStatus.SNOOZED);
      expect(notif?.snoozedUntil).toBeDefined();
    });

    it('should reject snoozeNotification for notification belonging to another tenant (IDOR prevention)', () => {
      expect(() => {
        notificationResolvers.Mutation.snoozeNotification(null, { notificationId: 'notif-4', userId: 'user-1', hours: 2 }, validContext);
      }).toThrow('Notification not found or access denied');
    });
  });

  describe('Mutation: escalateNotification', () => {
    it('should escalate notification for authorized tenant and user', () => {
      const result = notificationResolvers.Mutation.escalateNotification(null, { notificationId: 'notif-1', userId: 'user-1', targetManagerId: 'manager-1' }, validContext);
      expect(result).toBeDefined();
      expect(result?.severity).toBe(NotificationSeverity.CRITICAL);
      expect(result?.userId).toBe('manager-1');
      expect(result?.tenantId).toBe('tenant-1');
    });

    it('should reject escalateNotification for notification belonging to another tenant (IDOR prevention)', () => {
      expect(() => {
        notificationResolvers.Mutation.escalateNotification(null, { notificationId: 'notif-4', userId: 'user-1', targetManagerId: 'manager-1' }, validContext);
      }).toThrow('Notification not found or access denied');
    });
  });
});
