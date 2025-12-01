import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuthAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, adminId?: number, detail?: any) {
    await this.prisma.client.adminAuditLog.create({
      data: {
        action,
        adminId,
        detail: detail ?? undefined,
      },
    });
  }
}
