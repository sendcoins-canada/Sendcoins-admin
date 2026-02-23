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
      to: dto.to,
      cc: dto.cc?.length ? dto.cc : undefined,
      bcc: dto.bcc?.length ? dto.bcc : undefined,
      subject: dto.subject,
      text: dto.bodyText ?? undefined,
      html: dto.bodyHtml ?? undefined,
      fromName: dto.fromName ?? undefined,
    });

    const record = await this.prisma.client.adminSentEmail.create({
      data: {
        fromEmail: fromAddr,
        fromName: dto.fromName ?? null,
        toEmails: dto.to,
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
}
