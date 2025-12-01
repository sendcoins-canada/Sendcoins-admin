import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, adminId?: number, actorId?: number, detail?: any) {
    await this.prisma.client.adminAuditLog.create({
      data: {
        action,
        adminId,
        actorId,
        detail: detail ?? undefined,
      },
    });
  }
}
