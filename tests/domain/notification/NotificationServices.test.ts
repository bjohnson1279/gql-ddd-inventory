import { NotificationDispatcherService, NotificationInboxService } from '../../../src/domain/notification/NotificationServices';
import { Notification, NotificationPreference, NotificationCategory, NotificationSeverity, NotificationChannel } from '../../../src/domain/notification/NotificationEntities';
import * as crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();

describe('Notification Services', () => {
  it('Dispatcher should route based on preferences', () => {
    const dispatcher = new NotificationDispatcherService();
    const prefs = new Map<string, NotificationPreference>();
    prefs.set('u1', new NotificationPreference('p1', 't1', 'u1', NotificationCategory.INVENTORY_LEVEL, [NotificationChannel.EMAIL, NotificationChannel.IN_APP]));
    
    dispatcher.dispatch('t1', ['u1'], NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.WARNING, 'msg', {}, prefs);
    
    expect(dispatcher.inAppNotifications.length).toBe(1);
    expect(dispatcher.outboxEvents.length).toBe(1);
    expect(dispatcher.outboxEvents[0].type).toBe('SEND_EMAIL');
  });

  it('Inbox should track unread and snooze', () => {
    const notif = new Notification(uuidv4(), 't1', 'u1', NotificationCategory.INVENTORY_LEVEL, NotificationSeverity.INFO, 'msg');
    const inbox = new NotificationInboxService([notif]);
    
    expect(inbox.getUnreadCount('u1')).toBe(1);
    
    inbox.snooze(notif.id, 'u1', 24);
    expect(notif.status).toBe('SNOOZED');
    expect(notif.snoozedUntil).toBeDefined();
  });
});
