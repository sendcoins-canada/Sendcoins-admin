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
   * Get notification preferences for an admin (stub: returns defaults)
   */
  async getPreferences(
    _adminId: number,
  ): Promise<{ email: boolean; push: boolean; categories: Record<string, boolean> }> {
    return {
      email: true,
      push: true,
      categories: {
        SECURITY: true,
        TRANSACTION: true,
        ADMIN_MANAGEMENT: true,
        ROLE_MANAGEMENT: true,
      },
    };
  }

  /**
   * Update notification preferences (stub: accepts and echoes back)
   */
  async updatePreferences(
    _adminId: number,
    body: { email?: boolean; push?: boolean; categories?: Record<string, boolean> },
  ): Promise<{ email: boolean; push: boolean; categories: Record<string, boolean> }> {
    const current = await this.getPreferences(_adminId);
    return {
      email: body.email ?? current.email,
      push: body.push ?? current.push,
      categories: { ...current.categories, ...body.categories },
    };
  }

  /**
   * Send notification email based on type with proper HTML templates
   */
  private async sendNotificationEmail(
    email: string,
    firstName: string,
    type: AdminNotificationType,
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ): Promise<boolean> {
    const html = this.buildEmailTemplate(firstName, type, title, message, metadata);
    const text = this.buildPlainTextEmail(firstName, message, metadata);

    try {
      return await this.mailService.send({
        from: process.env.MAIL_FROM || 'noreply@sendcoins.com',
        to: email,
        subject: `[SendCoins Admin] ${title}`,
        text,
        html,
      });
    } catch (error) {
      console.error(`Failed to send notification email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Build HTML email template based on notification type
   */
  private buildEmailTemplate(
    firstName: string,
    type: AdminNotificationType,
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ): string {
    const iconColor = this.getNotificationColor(type);
    const icon = this.getNotificationIcon(type);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${iconColor}; padding: 24px 32px; text-align: center;">
              <span style="font-size: 32px;">${icon}</span>
              <h1 style="color: #ffffff; margin: 12px 0 0 0; font-size: 20px; font-weight: 600;">${title}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #333; font-size: 16px;">Hi ${firstName},</p>
              <p style="margin: 0 0 24px 0; color: #555; font-size: 15px; line-height: 1.6;">${message}</p>
              ${metadata ? this.buildMetadataSection(metadata) : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                This is an automated notification from SendCoins Admin Panel.
                <br>Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} SendCoins. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Build metadata section for email
   */
  private buildMetadataSection(metadata: NotificationMetadata): string {
    const items: string[] = [];

    if (metadata.ipAddress) {
      items.push(`<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">IP Address:</td><td style="padding: 8px 0 8px 16px; color: #374151; font-size: 13px;">${metadata.ipAddress}</td></tr>`);
    }
    if (metadata.device) {
      items.push(`<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Device:</td><td style="padding: 8px 0 8px 16px; color: #374151; font-size: 13px;">${metadata.device}</td></tr>`);
    }
    if (metadata.location) {
      items.push(`<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Location:</td><td style="padding: 8px 0 8px 16px; color: #374151; font-size: 13px;">${metadata.location}</td></tr>`);
    }
    if (metadata.transactionReference) {
      items.push(`<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Transaction:</td><td style="padding: 8px 0 8px 16px; color: #374151; font-size: 13px;">${metadata.transactionReference}</td></tr>`);
    }

    if (items.length === 0) return '';

    return `
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px; font-weight: 600;">Details</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${items.join('')}
        </table>
      </div>`;
  }

  /**
   * Get notification color based on type
   */
  private getNotificationColor(type: AdminNotificationType): string {
    switch (type) {
      case AdminNotificationType.ADMIN_LOGIN_FAILED:
      case AdminNotificationType.SUSPICIOUS_LOGIN_ATTEMPT:
      case AdminNotificationType.TRANSACTION_FLAGGED:
      case AdminNotificationType.ADMIN_DEACTIVATED:
        return '#dc2626'; // Red
      case AdminNotificationType.TRANSACTION_APPROVED:
      case AdminNotificationType.ADMIN_CREATED:
        return '#16a34a'; // Green
      case AdminNotificationType.HIGH_VALUE_TRANSACTION:
      case AdminNotificationType.NEW_IP_LOGIN:
        return '#d97706'; // Amber
      default:
        return '#2563eb'; // Blue
    }
  }

  /**
   * Get notification icon based on type
   */
  private getNotificationIcon(type: AdminNotificationType): string {
    switch (type) {
      case AdminNotificationType.ADMIN_LOGIN:
      case AdminNotificationType.NEW_IP_LOGIN:
        return '🔐';
      case AdminNotificationType.ADMIN_LOGIN_FAILED:
      case AdminNotificationType.SUSPICIOUS_LOGIN_ATTEMPT:
        return '⚠️';
      case AdminNotificationType.ADMIN_PASSWORD_CHANGED:
        return '🔑';
      case AdminNotificationType.ADMIN_CREATED:
        return '👤';
      case AdminNotificationType.ADMIN_DEACTIVATED:
        return '🚫';
      case AdminNotificationType.ADMIN_ROLE_CHANGED:
        return '👔';
      case AdminNotificationType.TRANSACTION_FLAGGED:
        return '🚩';
      case AdminNotificationType.TRANSACTION_APPROVED:
        return '✅';
      case AdminNotificationType.TRANSACTION_REJECTED:
        return '❌';
      case AdminNotificationType.HIGH_VALUE_TRANSACTION:
        return '💰';
      case AdminNotificationType.ROLE_CREATED:
      case AdminNotificationType.ROLE_UPDATED:
      case AdminNotificationType.ROLE_DELETED:
        return '🎭';
      default:
        return '📢';
    }
  }

  /**
   * Build plain text email fallback
   */
  private buildPlainTextEmail(
    firstName: string,
    message: string,
    metadata?: NotificationMetadata,
  ): string {
    let text = `Hi ${firstName},\n\n${message}\n\n`;

    if (metadata) {
      if (metadata.ipAddress) text += `IP Address: ${metadata.ipAddress}\n`;
      if (metadata.device) text += `Device: ${metadata.device}\n`;
      if (metadata.location) text += `Location: ${metadata.location}\n`;
      if (metadata.transactionReference) text += `Transaction: ${metadata.transactionReference}\n`;
    }

    text += `\nBest regards,\nSendCoins Team`;
    return text;
  }
}
