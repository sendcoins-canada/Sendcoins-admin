import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('AuditLogs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission(Permission.READ_AUDIT_LOGS)
  @ApiOperation({
    summary: 'Get audit logs',
    description:
      'Returns admin audit logs. Requires READ_AUDIT_LOGS permission. If you do not have this permission, access will be denied.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of logs to return (default: 50, max: 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of logs to skip (for pagination)',
  })
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = Number(offset) || 0;

    const logs = await this.prisma.client.adminAuditLog.findMany({
      take,
      skip,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await this.prisma.client.adminAuditLog.count();

    return {
      logs,
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + take < total,
      },
    };
  }
}
