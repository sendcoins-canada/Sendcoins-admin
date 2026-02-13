import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetConversionsQueryDto,
  ConversionStatus,
} from './dto/get-conversions-query.dto';

interface ConversionRow {
  id: number;
  reference: string;
  user_api_key: string;
  user_email: string;
  destination_country: string;
  currency: string;
  amount: string;
  full_name: string;
  bank_name: string;
  account_number: string;
  transit_number: string | null;
  notes: string | null;
  status: string | null;
  created_at: bigint;
  created_at_timestamp: Date | null;
  is_flagged: boolean | null;
  flagged_reason: string | null;
  status_notes: string | null;
}

@Injectable()
export class ConversionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetConversionsQueryDto) {
    const {
      page = 1,
      limit = 20,
      status = ConversionStatus.PENDING,
      search,
      country,
    } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status !== ConversionStatus.ALL) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      whereClause += ` AND (reference ILIKE $${paramIndex} OR user_email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (country) {
      whereClause += ` AND destination_country = $${paramIndex}`;
      params.push(country);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM fiat_bank_transfers ${whereClause}`;
    const countResult = await this.prisma.client.$queryRawUnsafe<
      [{ total: bigint }]
    >(countQuery, ...params);
    const total = Number(countResult[0]?.total || 0);

    const dataQuery = `
      SELECT id, reference, user_api_key, user_email, destination_country, currency, amount,
             full_name, bank_name, account_number, transit_number, notes, status,
             created_at, created_at_timestamp, is_flagged, flagged_reason, status_notes
      FROM fiat_bank_transfers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const conversions = await this.prisma.client.$queryRawUnsafe<
      ConversionRow[]
    >(dataQuery, ...params, limit, offset);

    return {
      conversions: conversions.map((c) => ({
        id: c.id,
        reference: c.reference,
        userEmail: c.user_email,
        destinationCountry: c.destination_country,
        currency: c.currency,
        amount: c.amount,
        recipientName: c.full_name,
        bankName: c.bank_name,
        accountNumber: c.account_number,
        transitNumber: c.transit_number,
        notes: c.notes,
        status: c.status || 'pending',
        isFlagged: c.is_flagged || false,
        flaggedReason: c.flagged_reason,
        statusNotes: c.status_notes,
        createdAt: c.created_at_timestamp || new Date(Number(c.created_at)),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const query = `
      SELECT id, reference, user_api_key, user_email, destination_country, currency, amount,
             full_name, bank_name, account_number, transit_number, notes, status,
             created_at, created_at_timestamp, is_flagged, flagged_reason, flagged_at,
             flagged_by, status_notes, status_updated_at, status_updated_by
      FROM fiat_bank_transfers
      WHERE id = $1
    `;

    const conversions = await this.prisma.client.$queryRawUnsafe<
      Array<
        ConversionRow & {
          flagged_at: bigint | null;
          flagged_by: string | null;
          status_updated_at: bigint | null;
          status_updated_by: string | null;
        }
      >
    >(query, id);

    if (!conversions.length) {
      throw new NotFoundException(`Conversion with ID ${id} not found`);
    }

    const c = conversions[0];

    return {
      id: c.id,
      reference: c.reference,
      userApiKey: c.user_api_key,
      userEmail: c.user_email,
      destinationCountry: c.destination_country,
      currency: c.currency,
      amount: c.amount,
      recipientName: c.full_name,
      bankName: c.bank_name,
      accountNumber: c.account_number,
      transitNumber: c.transit_number,
      notes: c.notes,
      status: c.status || 'pending',
      isFlagged: c.is_flagged || false,
      flaggedReason: c.flagged_reason,
      flaggedAt: c.flagged_at ? new Date(Number(c.flagged_at)) : null,
      flaggedBy: c.flagged_by,
      statusNotes: c.status_notes,
      statusUpdatedAt: c.status_updated_at
        ? new Date(Number(c.status_updated_at))
        : null,
      statusUpdatedBy: c.status_updated_by,
      createdAt: c.created_at_timestamp || new Date(Number(c.created_at)),
    };
  }

  async approve(id: number, adminId: number, notes?: string) {
    // Check if conversion exists
    const conversion = await this.findOne(id);

    if (conversion.status !== 'pending') {
      throw new BadRequestException(
        `Conversion is already ${conversion.status}`,
      );
    }

    const now = Date.now();

    // Get admin email for tracking
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
      select: { email: true },
    });

    const updateQuery = `
      UPDATE fiat_bank_transfers
      SET status = 'completed',
          status_notes = $2,
          status_updated_at = $3,
          status_updated_by = $4,
          updated_at = $3
      WHERE id = $1
    `;

    await this.prisma.client.$executeRawUnsafe(
      updateQuery,
      id,
      notes || 'Approved by admin',
      now,
      admin?.email || `admin_${adminId}`,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'CONVERSION_APPROVED',
        adminId,
        detail: {
          conversionId: id,
          reference: conversion.reference,
          amount: conversion.amount,
          currency: conversion.currency,
          notes,
        },
      },
    });

    return {
      success: true,
      message: `Conversion ${conversion.reference} has been approved`,
      id,
      status: 'completed',
    };
  }

  async reject(id: number, adminId: number, reason: string, notes?: string) {
    // Check if conversion exists
    const conversion = await this.findOne(id);

    if (conversion.status !== 'pending') {
      throw new BadRequestException(
        `Conversion is already ${conversion.status}`,
      );
    }

    const now = Date.now();

    // Get admin email for tracking
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
      select: { email: true },
    });

    const updateQuery = `
      UPDATE fiat_bank_transfers
      SET status = 'failed',
          status_notes = $2,
          status_updated_at = $3,
          status_updated_by = $4,
          updated_at = $3
      WHERE id = $1
    `;

    await this.prisma.client.$executeRawUnsafe(
      updateQuery,
      id,
      `Rejected: ${reason}${notes ? ` - ${notes}` : ''}`,
      now,
      admin?.email || `admin_${adminId}`,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'CONVERSION_REJECTED',
        adminId,
        detail: {
          conversionId: id,
          reference: conversion.reference,
          amount: conversion.amount,
          currency: conversion.currency,
          reason,
          notes,
        },
      },
    });

    return {
      success: true,
      message: `Conversion ${conversion.reference} has been rejected`,
      id,
      status: 'failed',
      reason,
    };
  }

  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN is_flagged = true THEN 1 END) as flagged,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN CAST(amount AS DECIMAL) END), 0) as pending_volume,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(amount AS DECIMAL) END), 0) as completed_volume
      FROM fiat_bank_transfers
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        total: bigint;
        pending: bigint;
        completed: bigint;
        failed: bigint;
        flagged: bigint;
        pending_volume: string | null;
        completed_volume: string | null;
      }>
    >(query);

    return {
      total: Number(result[0]?.total || 0),
      pending: Number(result[0]?.pending || 0),
      completed: Number(result[0]?.completed || 0),
      failed: Number(result[0]?.failed || 0),
      flagged: Number(result[0]?.flagged || 0),
      pendingVolume: result[0]?.pending_volume || '0',
      completedVolume: result[0]?.completed_volume || '0',
    };
  }
}
