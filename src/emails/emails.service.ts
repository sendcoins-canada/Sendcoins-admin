import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async sendAndSave(dto: SendEmailDto, adminId: number): Promise<{ id: number; sent: boolean }> {
    const fromEmail = process.env.MAIL_FROM ?? 'noreply@sendcoins.ca';
    const fromAddr = typeof fromEmail === 'string' && fromEmail.includes('<')
      ? fromEmail.replace(/^[^<]*<([^>]+)>.*$/, '$1').trim()
      : fromEmail;

    const sent = await this.mailService.sendCustomEmail({
      to: dto.to?.length ? dto.to : [],
      cc: dto.cc?.length ? dto.cc : undefined,
      bcc: dto.bcc?.length ? dto.bcc : undefined,
      subject: dto.subject,
      text: dto.bodyText ?? undefined,
      html: dto.bodyHtml ?? undefined,
      fromName: dto.fromName ?? undefined,
      attachments: dto.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.contentBase64, 'base64'),
        contentType: a.contentType,
      })),
    });

    const record = await this.prisma.client.adminSentEmail.create({
      data: {
        fromEmail: fromAddr,
        fromName: dto.fromName ?? null,
        toEmails: dto.to ?? [],
        ccEmails: dto.cc ?? [],
        bccEmails: dto.bcc ?? [],
        subject: dto.subject,
        bodyText: dto.bodyText ?? null,
        bodyHtml: dto.bodyHtml ?? null,
        status: sent ? 'sent' : 'failed',
        sentAt: sent ? new Date() : null,
        createdById: adminId,
      },
    });

    return { id: record.id, sent };
  }

  async list(params: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = params.status ? { status: params.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.client.adminSentEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.adminSentEmail.count({ where }),
    ]);

    return {
      data: items.map((row) => ({
        id: row.id,
        fromEmail: row.fromEmail,
        fromName: row.fromName,
        toEmails: row.toEmails,
        ccEmails: row.ccEmails,
        bccEmails: row.bccEmails,
        subject: row.subject,
        bodyText: row.bodyText,
        bodyHtml: row.bodyHtml,
        status: row.status,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOne(id: number) {
    const row = await this.prisma.client.adminSentEmail.findUnique({
      where: { id },
    });
    if (!row) return null;
    return {
      id: row.id,
      fromEmail: row.fromEmail,
      fromName: row.fromName,
      toEmails: row.toEmails,
      ccEmails: row.ccEmails,
      bccEmails: row.bccEmails,
      subject: row.subject,
      bodyText: row.bodyText,
      bodyHtml: row.bodyHtml,
      status: row.status,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Campaign helpers
  // ---------------------------------------------------------------------------

  async getCampaignStats() {
    const [unverified, inactive] = await Promise.all([
      this.prisma.client.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM send_coin_user
         WHERE (verify_user IS NULL OR verify_user = false)
         AND account_ban = 'false'
         AND user_email IS NOT NULL`,
      ),
      this.prisma.client.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM send_coin_user u
         WHERE account_ban = 'false'
         AND user_email IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM transaction_history th WHERE th.user_api_key = u.api_key)
         AND NOT EXISTS (SELECT 1 FROM wallet_transfers wt WHERE wt.user_api_key = u.api_key)
         AND NOT EXISTS (SELECT 1 FROM fiat_bank_transfers fbt WHERE fbt.user_api_key = u.api_key)`,
      ),
    ]);
    return {
      unverified: Number(unverified[0]?.count ?? 0),
      inactive: Number(inactive[0]?.count ?? 0),
    };
  }

  async sendUnverifiedReminders(adminId: number) {
    const users = await this.prisma.client.$queryRawUnsafe<
      Array<{ user_email: string; first_name: string | null }>
    >(
      `SELECT user_email, first_name FROM send_coin_user
       WHERE (verify_user IS NULL OR verify_user = false)
       AND account_ban = 'false'
       AND user_email IS NOT NULL`,
    );

    if (!users.length) return { sent: false, count: 0 };

    const fromEmail = process.env.MAIL_FROM ?? 'noreply@sendcoins.ca';
    const fromAddr = fromEmail.includes('<')
      ? fromEmail.replace(/^[^<]*<([^>]+)>.*$/, '$1').trim()
      : fromEmail;

    const subject = 'Complete your Sendcoins account verification';
    const buildHtml = (firstName: string | null) => `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="margin-bottom:24px">
          <img src="https://sendcoins.ca/images/logoblack.svg" alt="Sendcoins" style="height:40px" />
        </div>
        <h2 style="color:#1a1a2e">Hi ${firstName ?? 'there'} 👋</h2>
        <p style="color:#444;line-height:1.6">
          You signed up for Sendcoins but haven't verified your account yet.
          Verification takes less than 2 minutes and unlocks sending and converting
          crypto.
        </p>
        <a href="${process.env.ADMIN_FRONTEND_URL?.replace('admin.', '') ?? 'https://app.sendcoins.ca'}/kyc"
           style="display:inline-block;margin:16px 0;padding:12px 28px;background:#0647F7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verify my account →
        </a>
        <p style="color:#888;font-size:13px">
          If you didn't create this account, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <div style="text-align:center">
          <p style="color:#888;font-size:13px;margin-bottom:12px">Get the Sendcoins app</p>
          <a href="https://play.google.com/store/apps/details?id=com.sendcoins.app">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" style="height:44px" />
          </a>
        </div>
      </div>`;

    let sentCount = 0;
    for (const user of users) {
      try {
        await this.mailService.sendCustomEmail({
          to: [user.user_email],
          subject,
          html: buildHtml(user.first_name),
          fromName: 'Sendcoins',
        });
        sentCount++;
      } catch (err) {
        this.logger.warn(`Failed to send unverified reminder to ${user.user_email}: ${err}`);
      }
    }

    const emails = users.map((u) => u.user_email);
    await this.prisma.client.adminSentEmail.create({
      data: {
        fromEmail: fromAddr,
        fromName: 'Sendcoins',
        toEmails: emails,
        ccEmails: [],
        bccEmails: [],
        subject,
        bodyText: null,
        bodyHtml: buildHtml(null),
        status: sentCount > 0 ? 'sent' : 'failed',
        sentAt: sentCount > 0 ? new Date() : null,
        createdById: adminId,
      },
    });

    return { sent: sentCount > 0, count: sentCount, total: users.length };
  }

  async sendInactiveOutreach(adminId: number) {
    const users = await this.prisma.client.$queryRawUnsafe<
      Array<{ user_email: string; first_name: string | null }>
    >(
      `SELECT u.user_email, u.first_name FROM send_coin_user u
       WHERE u.account_ban = 'false'
       AND u.user_email IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM transaction_history th WHERE th.user_api_key = u.api_key)
       AND NOT EXISTS (SELECT 1 FROM wallet_transfers wt WHERE wt.user_api_key = u.api_key)
       AND NOT EXISTS (SELECT 1 FROM fiat_bank_transfers fbt WHERE fbt.user_api_key = u.api_key)`,
    );

    if (!users.length) return { sent: false, count: 0 };

    const fromEmail = process.env.MAIL_FROM ?? 'noreply@sendcoins.ca';
    const fromAddr = fromEmail.includes('<')
      ? fromEmail.replace(/^[^<]*<([^>]+)>.*$/, '$1').trim()
      : fromEmail;

    const subject = 'Your Sendcoins wallet is ready — make your first move';
    const buildHtml = (firstName: string | null) => `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="margin-bottom:24px">
          <img src="https://sendcoins.ca/images/logoblack.svg" alt="Sendcoins" style="height:40px" />
        </div>
        <h2 style="color:#1a1a2e">Hi ${firstName ?? 'there'} 👋</h2>
        <p style="color:#444;line-height:1.6">
          Your Sendcoins wallet is set up and ready to go — but you haven't made
          a transaction yet. Here's what you can do right now:
        </p>
        <ul style="color:#444;line-height:2">
          <li>💸 <strong>Send crypto</strong> to anyone, anywhere</li>
          <li>🔄 <strong>Convert</strong> Fiat to USDT</li>
          <li>🏦 <strong>Withdraw</strong> cash to your local bank account directly</li>
        </ul>
        <a href="${process.env.ADMIN_FRONTEND_URL?.replace('admin.', '') ?? 'https://app.sendcoins.ca'}/dashboard"
           style="display:inline-block;margin:16px 0;padding:12px 28px;background:#0647F7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Get started →
        </a>
        <p style="color:#888;font-size:13px">
          Questions? Reply to this email — we're happy to help.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <div style="text-align:center">
          <p style="color:#888;font-size:13px;margin-bottom:12px">Get the Sendcoins app</p>
          <a href="https://play.google.com/store/apps/details?id=com.sendcoins.app">
            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" style="height:44px" />
          </a>
        </div>
      </div>`;

    let sentCount = 0;
    for (const user of users) {
      try {
        await this.mailService.sendCustomEmail({
          to: [user.user_email],
          subject,
          html: buildHtml(user.first_name),
          fromName: 'Sendcoins',
        });
        sentCount++;
      } catch (err) {
        this.logger.warn(`Failed to send inactive outreach to ${user.user_email}: ${err}`);
      }
    }

    const emails = users.map((u) => u.user_email);
    await this.prisma.client.adminSentEmail.create({
      data: {
        fromEmail: fromAddr,
        fromName: 'Sendcoins',
        toEmails: emails,
        ccEmails: [],
        bccEmails: [],
        subject,
        bodyText: null,
        bodyHtml: buildHtml(null),
        status: sentCount > 0 ? 'sent' : 'failed',
        sentAt: sentCount > 0 ? new Date() : null,
        createdById: adminId,
      },
    });

    return { sent: sentCount > 0, count: sentCount, total: users.length };
  }
}
