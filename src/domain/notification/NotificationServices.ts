import { v4 as uuidv4 } from 'uuid';
import { 
  Notification, NotificationPreference, NotificationCategory, 
  NotificationSeverity, NotificationChannel, NotificationStatus 
} from './NotificationEntities';

export class NotificationDispatcherService {
  public outboxEvents: any[] = [];
  public inAppNotifications: Notification[] = [];

  public dispatch(
    tenantId: string,
    targetUsers: string[],
    category: NotificationCategory,
    severity: NotificationSeverity,
    message: string,
    metadata: Record<string, any>,
    preferences: Map<string, NotificationPreference>
  ): void {
    for (const userId of targetUsers) {
      const pref = preferences.get(userId);
      if (pref && pref.isMuted && severity !== NotificationSeverity.CRITICAL) {
        continue;
      }

      const channels = pref ? pref.channels : [NotificationChannel.IN_APP];

      if (channels.includes(NotificationChannel.IN_APP)) {
        const notif = new Notification(
          uuidv4(), tenantId, userId, category, severity, message, metadata
        );
        this.inAppNotifications.push(notif);
      }

      if (channels.includes(NotificationChannel.EMAIL)) {
        this.outboxEvents.push({ type: 'SEND_EMAIL', userId, message });
      }

      if (channels.includes(NotificationChannel.SMS)) {
        this.outboxEvents.push({ type: 'SEND_SMS', userId, message });
      }
    }
  }
}

export class NotificationInboxService {
  constructor(public notifications: Notification[]) {}

  private getNotification(notifId: string, userId: string): Notification | null {
    return this.notifications.find(n => n.id === notifId && n.userId === userId) || null;
  }

  public markAsRead(notifId: string, userId: string): boolean {
    const n = this.getNotification(notifId, userId);
    if (!n) return false;
    n.markAsRead();
    return true;
  }

  public snooze(notifId: string, userId: string, hours: number): boolean {
    const n = this.getNotification(notifId, userId);
    if (!n) return false;
    const until = new Date();
    until.setHours(until.getHours() + hours);
    n.snooze(until);
    return true;
  }

  public escalate(notifId: string, userId: string, targetManagerId: string): Notification | null {
    const n = this.getNotification(notifId, userId);
    if (!n) return null;
    
    n.escalate();
    
    const escalatedNotif = new Notification(
      uuidv4(), n.tenantId, targetManagerId, n.category, 
      NotificationSeverity.CRITICAL, `[ESCALATED from ${userId}] ${n.message}`, n.metadata
    );
    this.notifications.push(escalatedNotif);
    
    return escalatedNotif;
  }

  public getUnreadCount(userId: string): number {
    return this.notifications.filter(n => n.userId === userId && n.status === NotificationStatus.UNREAD).length;
  }
}
