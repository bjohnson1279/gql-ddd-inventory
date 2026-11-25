import { agingResolvers } from '../agingResolvers';
import { intercompanyResolvers } from '../intercompanyResolvers';
import { laborResolvers } from '../laborResolvers';
import { notificationInboxService, notificationResolvers } from '../notificationResolvers';
import { yieldResolvers } from '../yieldResolvers';
import {
  Notification,
  NotificationCategory,
  NotificationSeverity,
  NotificationStatus,
} from '../../../domain/notification/NotificationEntities';

describe('Phase 15-19 GraphQL Resolvers', () => {
  describe('agingResolvers', () => {
    it('analyzes inventory aging and computes potential scrap emissions', () => {
      const result = agingResolvers.Query.analyzeAging(null, {
        sku: 'SKU-OLD-1',
        locationId: 'WH-A',
        tenantId: 'tenant-1',
      });
      expect(result).toBeDefined();
      expect(result.sku).toBe('SKU-OLD-1');
      expect(result.potentialScrapEmissionsKg).toBeGreaterThan(0);
    });
  });

  describe('intercompanyResolvers', () => {
    it('generates consolidated intercompany revenue after eliminations', () => {
      const consolidated = intercompanyResolvers.Query.intercompanyConsolidatedRevenue(null, {
        tenantId: 'tenant-ic',
      });
      expect(typeof consolidated).toBe('number');
    });
  });

  describe('laborResolvers', () => {
    it('predicts warehouse staffing requirements for a target date', () => {
      const rec = laborResolvers.Query.predictStaffing(null, {
        targetDate: '2026-12-01T00:00:00Z',
        inboundVol: 400,
        outboundVol: 600,
        avgPicks: 50,
      });
      expect(rec).toBeDefined();
      expect(rec.recommendedHeadcount).toBeGreaterThan(0);
    });
  });

  describe('yieldResolvers', () => {
    it('recommends a markdown when holding costs or expiration justify discounting', () => {
      const rec = yieldResolvers.Query.recommendMarkdown(null, {
        metrics: {
          sku: 'SKU-Y1',
          daysInInventory: 30,
          daysUntilExpiration: 5,
          historicalDailyDemand: 2,
          currentStockQuantity: 50,
        },
        profile: {
          sku: 'SKU-Y1',
          basePriceCents: 5000,
          holdingCostPerDayCents: 50,
          minFloorPriceCents: 2000,
        },
      });
      expect(rec).not.toBeNull();
      expect(rec!.recommendedPriceCents).toBeLessThan(5000);
    });

    it('returns null when no markdown is needed', () => {
      const rec = yieldResolvers.Query.recommendMarkdown(null, {
        metrics: {
          sku: 'SKU-Y2',
          daysInInventory: 0,
          daysUntilExpiration: null,
          historicalDailyDemand: 5,
          currentStockQuantity: 10,
        },
        profile: {
          sku: 'SKU-Y2',
          basePriceCents: 5000,
          holdingCostPerDayCents: 0,
          minFloorPriceCents: 2000,
        },
      });
      expect(rec).toBeNull();
    });
  });

  describe('notificationResolvers', () => {
    const authCtx = { auth: { tenantId: 'tenant-n1', userId: 'user-1' } };
    const otherTenantCtx = { auth: { tenantId: 'tenant-n2', actorId: 'user-1' } };
    let notif1: Notification;
    let notif2: Notification;

    beforeEach(() => {
      notificationInboxService.notifications.length = 0;
      notif1 = new Notification(
        'notif-1',
        'tenant-n1',
        'user-1',
        NotificationCategory.INVENTORY_LEVEL,
        NotificationSeverity.WARNING,
        'SKU-1 below reorder point',
        {},
        NotificationStatus.UNREAD,
        new Date('2026-10-01T10:00:00Z'),
        null,
      );
      notif2 = new Notification(
        'notif-2',
        'tenant-n1',
        'user-1',
        NotificationCategory.APPROVAL_REQUIRED,
        NotificationSeverity.INFO,
        'Cycle count ready for review',
        {},
        NotificationStatus.UNREAD,
        new Date('2026-10-01T11:00:00Z'),
        null,
      );
      notificationInboxService.notifications.push(notif1, notif2);
    });

    it('enforces authentication and tenantId presence', () => {
      expect(() =>
        notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, {}),
      ).toThrow(/Authentication required/);

      expect(() =>
        notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, { auth: {} }),
      ).toThrow(/Tenant identification missing/);
    });

    it('counts unread notifications scoped by tenant and user', () => {
      expect(
        notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, authCtx),
      ).toBe(2);
      expect(
        notificationResolvers.Query.unreadNotificationCount(null, { userId: 'user-1' }, otherTenantCtx),
      ).toBe(0);
    });

    it('marks read, snoozes, escalates, and blocks cross-tenant mutations', () => {
      expect(() =>
        notificationResolvers.Mutation.markNotificationRead(
          null,
          { notificationId: 'notif-1', userId: 'user-1' },
          otherTenantCtx,
        ),
      ).toThrow(/not found or access denied/);

      expect(() =>
        notificationResolvers.Mutation.snoozeNotification(
          null,
          { notificationId: 'notif-1', userId: 'user-1', hours: 4 },
          otherTenantCtx,
        ),
      ).toThrow(/not found or access denied/);

      expect(() =>
        notificationResolvers.Mutation.escalateNotification(
          null,
          { notificationId: 'notif-1', userId: 'user-1', targetManagerId: 'mgr-1' },
          otherTenantCtx,
        ),
      ).toThrow(/not found or access denied/);

      expect(
        notificationResolvers.Mutation.markNotificationRead(
          null,
          { notificationId: 'notif-1', userId: 'user-1' },
          authCtx,
        ),
      ).toBe(true);
      expect(notif1.status).toBe(NotificationStatus.READ);
      expect(notificationResolvers.Notification.createdAt(notif1)).toBe('2026-10-01T10:00:00.000Z');
      expect(notificationResolvers.Notification.snoozedUntil(notif1)).toBeNull();

      expect(
        notificationResolvers.Mutation.snoozeNotification(
          null,
          { notificationId: 'notif-2', userId: 'user-1', hours: 2 },
          authCtx,
        ),
      ).toBe(true);
      expect(notif2.status).toBe(NotificationStatus.SNOOZED);
      expect(notificationResolvers.Notification.snoozedUntil(notif2)).toEqual(expect.any(String));

      const escalated = notificationResolvers.Mutation.escalateNotification(
        null,
        { notificationId: 'notif-2', userId: 'user-1', targetManagerId: 'mgr-99' },
        authCtx,
      );
      expect(escalated).not.toBeNull();
      expect(escalated!.userId).toBe('mgr-99');
    });
  });
});
