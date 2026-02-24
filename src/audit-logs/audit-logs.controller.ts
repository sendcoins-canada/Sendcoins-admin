import { Controller, Get, Query, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

type Detail = Record<string, unknown> | null;

function mapLog(
  log: {
    id: number;
    adminId: number | null;
    action: string;
    detail: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    admin?: { firstName: string; lastName: string; email: string } | null;
  },
): {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  details?: Detail;
  ip: string;
  userAgent: string;
  createdAt: string;
} {
  const detail = (log.detail as Detail) ?? {};
  const resourceType = (detail?.resourceType as string) ?? (detail?.resource as string) ?? 'AUDIT';
  const resourceId = String(detail?.resourceId ?? detail?.id ?? '');
  const admin = log.admin;
  const adminName = admin
    ? `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || admin.email
    : 'System';
  return {
    id: String(log.id),
    action: log.action,
    resourceType,
    resourceId,
    adminId: log.adminId != null ? String(log.adminId) : '',
    adminName,
    adminEmail: admin?.email ?? '',
    details: detail && typeof detail === 'object' ? detail : undefined,
    ip: log.ipAddress ?? '',
    userAgent: log.userAgent ?? '',
    createdAt: log.createdAt.toISOString(),
  };
}

@ApiTags('AuditLogs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('export')
  @RequirePermission(Permission.READ_AUDIT_LOGS)
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async exportLogs(
    @Res() res: express.Response,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    const take = Math.min(Number(limit) || 1000, 5000);
    const skip = Number(offset) || 0;
    const where = buildWhere(action, search);

    const logs = await this.prisma.client.adminAuditLog.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });
    const adminIds = [...new Set(logs.map((l) => l.adminId).filter((id): id is number => id != null))];
    const admins =
      adminIds.length > 0
        ? await this.prisma.client.adminUser.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    const rows = logs.map((log) =>
      mapLog({
        ...log,
        admin: log.adminId ? adminMap.get(log.adminId) ?? null : null,
      }),
    );
    const header = 'id,action,resourceType,resourceId,adminId,adminName,adminEmail,ip,createdAt\n';
    const csv =
      header +
      rows
        .map(
          (r) =>
            `${r.id},${escapeCsv(r.action)},${escapeCsv(r.resourceType)},${escapeCsv(r.resourceId)},${r.adminId},${escapeCsv(r.adminName)},${escapeCsv(r.adminEmail)},${escapeCsv(r.ip)},${r.createdAt}`,
        )
        .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${Date.now()}.csv"`,
    );
    res.send(csv);
  }

  @Get()
  @RequirePermission(Permission.READ_AUDIT_LOGS)
  @ApiOperation({
    summary: 'Get audit logs',
    description:
      'Returns admin audit logs. Requires READ_AUDIT_LOGS permission.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('page') page?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    const limitNum = Math.min(Number(limit) || 50, 100);
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = offset !== undefined && offset !== '' ? Number(offset) : (pageNum - 1) * limitNum;

    const take = limitNum;
    const where = buildWhere(action, search);

    const [logs, total] = await Promise.all([
      this.prisma.client.adminAuditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.adminAuditLog.count({ where }),
    ]);
    const adminIds = [...new Set(logs.map((l) => l.adminId).filter((id): id is number => id != null))];
    const admins =
      adminIds.length > 0
        ? await this.prisma.client.adminUser.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    const mapped = logs.map((log) =>
      mapLog({
        ...log,
        admin: log.adminId ? adminMap.get(log.adminId) ?? null : null,
      }),
    );

    const totalPages = take > 0 ? Math.ceil(total / take) : 0;
    const currentPage = take > 0 ? Math.floor(skip / take) + 1 : 1;
    return {
      data: mapped,
      logs: mapped,
      pagination: {
        total,
        limit: take,
        offset: skip,
        page: currentPage,
        totalPages,
        hasMore: skip + take < total,
      },
    };
  }

  @Get('admin/:adminId')
  @RequirePermission(Permission.READ_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get audit logs for an admin' })
  @ApiParam({ name: 'adminId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getAuditLogsByAdmin(
    @Param('adminId', ParseIntPipe) adminId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = Number(offset) || 0;

    const [logs, total] = await Promise.all([
      this.prisma.client.adminAuditLog.findMany({
        where: { adminId },
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.adminAuditLog.count({ where: { adminId } }),
    ]);
    const admins =
      logs.length > 0
        ? await this.prisma.client.adminUser.findMany({
            where: { id: adminId },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    const mappedByAdmin = logs.map((log) =>
      mapLog({
        ...log,
        admin: log.adminId ? adminMap.get(log.adminId) ?? null : null,
      }),
    );
    const totalPages = take > 0 ? Math.ceil(total / take) : 0;
    const page = take > 0 ? Math.floor(skip / take) + 1 : 1;
    return {
      data: mappedByAdmin,
      logs: mappedByAdmin,
      pagination: { total, limit: take, offset: skip, page, totalPages, hasMore: skip + take < total },
    };
  }

  @Get('resource/:resourceType/:resourceId')
  @RequirePermission(Permission.READ_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get audit logs for a resource' })
  @ApiParam({ name: 'resourceType', type: String })
  @ApiParam({ name: 'resourceId', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getAuditLogsByResource(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = Number(offset) || 0;

    const where = {
      detail: {
        path: ['resourceType'],
        equals: resourceType,
      } as unknown as Record<string, unknown>,
    };
    const whereResource = {
      OR: [
        { detail: { path: ['resourceType'], equals: resourceType } as unknown as Record<string, unknown> },
        { detail: { path: ['resourceId'], equals: resourceId } as unknown as Record<string, unknown> },
      ],
    };
    const logs = await this.prisma.client.adminAuditLog.findMany({
      where: whereResource,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.client.adminAuditLog.count({ where: whereResource });
    const adminIds = [...new Set(logs.map((l) => l.adminId).filter((id): id is number => id != null))];
    const admins =
      adminIds.length > 0
        ? await this.prisma.client.adminUser.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    const mappedByResource = logs.map((log) =>
      mapLog({
        ...log,
        admin: log.adminId ? adminMap.get(log.adminId) ?? null : null,
      }),
    );
    const totalPages = take > 0 ? Math.ceil(total / take) : 0;
    const pageNum = take > 0 ? Math.floor(skip / take) + 1 : 1;
    return {
      data: mappedByResource,
      logs: mappedByResource,
      pagination: { total, limit: take, offset: skip, page: pageNum, totalPages, hasMore: skip + take < total },
    };
  }

  @Get(':id')
  @RequirePermission(Permission.READ_AUDIT_LOGS)
  @ApiOperation({ summary: 'Get a single audit log by ID' })
  @ApiParam({ name: 'id', type: Number })
  async getAuditLogById(@Param('id', ParseIntPipe) id: number) {
    const log = await this.prisma.client.adminAuditLog.findUnique({
      where: { id },
    });
    if (!log) return null;
    const admin =
      log.adminId != null
        ? await this.prisma.client.adminUser.findUnique({
            where: { id: log.adminId },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : null;
    return mapLog({ ...log, admin });
  }
}

function buildWhere(action?: string, search?: string) {
  const exact = action?.trim();
  const searchStr = search?.trim();
  if (!exact && !searchStr) return {};
  if (exact && !searchStr) return { action: exact };
  if (!exact && searchStr)
    return { action: { contains: searchStr, mode: 'insensitive' as const } };
  return {
    AND: [
      { action: exact },
      { action: { contains: searchStr!, mode: 'insensitive' as const } },
    ],
  };
}

function escapeCsv(val: string): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
