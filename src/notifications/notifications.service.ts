import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  AdminNotificationType,
  AdminNotificationCategory,
  AdminNotificationPriority,
  AdminNotification,
  Permission,
} from '@prisma/client';
import { GetNotificationsDto } from './dto/get-notifications.dto';

// Type for notification metadata
interface NotificationMetadata {
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  device?: string;
  transactionId?: number;
  transactionReference?: string;
  transactionAmount?: string;
  transactionCurrency?: string;
  adminEmail?: string;
  adminName?: string;
  oldRole?: string;
  newRole?: string;
  [key: string]: unknown;
}

// Options for creating notifications
interface CreateNotificationOptions {
  category?: AdminNotificationCategory;
  priority?: AdminNotificationPriority;
  metadata?: NotificationMetadata;
  actionUrl?: string;
  sendEmail?: boolean;
}

// Response types
export interface NotificationCountResponse {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
}

export interface PaginatedNotificationsResponse {
  data: AdminNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Map notification types to categories
const TYPE_TO_CATEGORY: Record<
  AdminNotificationType,
  AdminNotificationCategory
> = {
  ADMIN_LOGIN: AdminNotificationCategory.SECURITY,
  ADMIN_LOGIN_FAILED: AdminNotificationCategory.SECURITY,
  ADMIN_PASSWORD_CHANGED: AdminNotificationCategory.SECURITY,
  SUSPICIOUS_LOGIN_ATTEMPT: AdminNotificationCategory.SECURITY,
  NEW_IP_LOGIN: AdminNotificationCategory.SECURITY,
  ADMIN_CREATED: AdminNotificationCategory.ADMIN_MANAGEMENT,
  ADMIN_DEACTIVATED: AdminNotificationCategory.ADMIN_MANAGEMENT,
  ADMIN_ROLE_CHANGED: AdminNotificationCategory.ADMIN_MANAGEMENT,
  TRANSACTION_FLAGGED: AdminNotificationCategory.TRANSACTION,
  TRANSACTION_APPROVED: AdminNotificationCategory.TRANSACTION,
  TRANSACTION_REJECTED: AdminNotificationCategory.TRANSACTION,
  HIGH_VALUE_TRANSACTION: AdminNotificationCategory.TRANSACTION,
  ROLE_CREATED: AdminNotificationCategory.ROLE_MANAGEMENT,
  ROLE_UPDATED: AdminNotificationCategory.ROLE_MANAGEMENT,
  ROLE_DELETED: AdminNotificationCategory.ROLE_MANAGEMENT,
};

// Types that should trigger email by default
const EMAIL_ENABLED_TYPES: AdminNotificationType[] = [
  AdminNotificationType.ADMIN_LOGIN_FAILED,
  AdminNotificationType.ADMIN_PASSWORD_CHANGED,
  AdminNotificationType.SUSPICIOUS_LOGIN_ATTEMPT,
  AdminNotificationType.NEW_IP_LOGIN,
  AdminNotificationType.ADMIN_CREATED,
  AdminNotificationType.ADMIN_DEACTIVATED,
  AdminNotificationType.TRANSACTION_FLAGGED,
  AdminNotificationType.HIGH_VALUE_TRANSACTION,
];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Create a notification for an admin
   */
  async create(
    adminId: number,
    type: AdminNotificationType,
    title: string,
    message: string,
    options?: CreateNotificationOptions,
  ): Promise<AdminNotification> {
    const category = options?.category ?? TYPE_TO_CATEGORY[type];
    const priority = options?.priority ?? AdminNotificationPriority.NORMAL;

    const notification = await this.prisma.client.adminNotification.create({
      data: {
        adminId,
        type,
        category,
        priority,
        title,
        message,
        metadata: (options?.metadata ?? {}) as object,
        actionUrl: options?.actionUrl,
      },
    });

    // Send email if configured
    const shouldSendEmail =
      options?.sendEmail !== false && EMAIL_ENABLED_TYPES.includes(type);

    if (shouldSendEmail) {
      const admin = await this.prisma.client.adminUser.findUnique({
        where: { id: adminId },
        select: { email: true, firstName: true },
      });

      if (admin) {
        const emailSent = await this.sendNotificationEmail(
          admin.email,
          admin.firstName,
          type,
          title,
          message,
          options?.metadata,
        );

        if (emailSent) {
          await this.prisma.client.adminNotification.update({
            where: { id: notification.id },
            data: { emailSent: true },
          });
        }
      }
    }

    return notification;
  }

  /**
   * Notify multiple admins
   */
  async notifyAdmins(
    adminIds: number[],
    type: AdminNotificationType,
    title: string,
    message: string,
    options?: CreateNotificationOptions,
  ): Promise<AdminNotification[]> {
    const notifications = await Promise.all(
      adminIds.map((adminId) =>
        this.create(adminId, type, title, message, options),
      ),
    );
    return notifications;
  }

  /**
   * Notify all admins with a specific permission
   */
  async notifyAdminsByPermission(
    permission: Permission,
    type: AdminNotificationType,
    title: string,
    message: string,
    options?: CreateNotificationOptions,
  ): Promise<AdminNotification[]> {
    // Find all active admins with the specified permission via their role
    const admins = await this.prisma.client.adminUser.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        dynamicRole: {
          status: 'ACTIVE',
          permissions: {
            some: {
              permission,
              isActive: true,
            },
          },
        },
      },
      select: { id: true },
    });

    if (admins.length === 0) {
      return [];
    }

    return this.notifyAdmins(
      admins.map((a) => a.id),
      type,
      title,
      message,
      options,
    );
  }

  /**
   * Get paginated notifications for an admin
   */
  async findAll(
    adminId: number,
    dto: GetNotificationsDto,
  ): Promise<PaginatedNotificationsResponse> {
    const { page = 1, limit = 20, type, category, isRead } = dto;
    const skip = (page - 1) * limit;

    const where = {
      adminId,
      ...(type && { type }),
      ...(category && { category }),
      ...(isRead !== undefined && { isRead }),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.client.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.adminNotification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread notification count by category
   */
  async getUnreadCount(adminId: number): Promise<NotificationCountResponse> {
    const [total, unread, byCategoryRaw] = await Promise.all([
      this.prisma.client.adminNotification.count({
        where: { adminId },
      }),
      this.prisma.client.adminNotification.count({
        where: { adminId, isRead: false },
      }),
      this.prisma.client.adminNotification.groupBy({
        by: ['category'],
        where: { adminId, isRead: false },
        _count: { id: true },
      }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const item of byCategoryRaw) {
      byCategory[item.category] = item._count.id;
    }

    return { total, unread, byCategory };
  }

  /**
   * Mark specific notifications as read
   */
  async markAsRead(
    adminId: number,
    notificationIds: number[],
  ): Promise<{ updated: number }> {
    const result = await this.prisma.client.adminNotification.updateMany({
      where: {
        id: { in: notificationIds },
        adminId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(adminId: number): Promise<{ updated: number }> {
    const result = await this.prisma.client.adminNotification.updateMany({
      where: {
        adminId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  /**
   * Delete specific notifications
   */
  async delete(
    adminId: number,
    notificationIds: number[],
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.client.adminNotification.deleteMany({
      where: {
        id: { in: notificationIds },
        adminId,
      },
    });

    return { deleted: result.count };
  }

  /**
   * Send notification email based on type
   * TODO: Implement specific email templates in MailService
   */
  private async sendNotificationEmail(
    email: string,
    firstName: string,
    type: AdminNotificationType,
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ): Promise<boolean> {
    // For now, send a generic notification email
    // TODO: Add specific email templates to MailService
    try {
      return await this.mailService.send({
        from: process.env.MAIL_FROM,
        to: email,
        subject: title,
        text: `Hi ${firstName},\n\n${message}\n\n${metadata?.ipAddress ? `IP: ${metadata.ipAddress}` : ''}\n${metadata?.device ? `Device: ${metadata.device}` : ''}\n\nBest,\nSendCoins Team`,
      });
    } catch {
      console.error(`Failed to send notification email to ${email}`);
      return false;
    }
  }
}
