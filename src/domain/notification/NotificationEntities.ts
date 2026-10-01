export enum NotificationCategory {
  INVENTORY_LEVEL = 'INVENTORY_LEVEL',
  SYSTEM_ANOMALY = 'SYSTEM_ANOMALY',
  WEBHOOK_FAILURE = 'WEBHOOK_FAILURE',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED'
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  SNOOZED = 'SNOOZED',
  ESCALATED = 'ESCALATED'
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WEBHOOK = 'WEBHOOK'
}

export class Notification {
  constructor(
    public id: string,
    public tenantId: string,
    public userId: string,
    public category: NotificationCategory,
    public severity: NotificationSeverity,
    public message: string,
    public metadata: Record<string, any> = {},
    public status: NotificationStatus = NotificationStatus.UNREAD,
    public createdAt: Date = new Date(),
    public snoozedUntil: Date | null = null
  ) {}

  public markAsRead(): void {
    this.status = NotificationStatus.READ;
  }

  public snooze(until: Date): void {
    this.status = NotificationStatus.SNOOZED;
    this.snoozedUntil = until;
  }

  public escalate(): void {
    this.status = NotificationStatus.ESCALATED;
    this.severity = NotificationSeverity.CRITICAL;
  }
}

export class NotificationPreference {
  constructor(
    public id: string,
    public tenantId: string,
    public userId: string,
    public category: NotificationCategory,
    public channels: NotificationChannel[] = [NotificationChannel.IN_APP],
    public isMuted: boolean = false
  ) {}
}
