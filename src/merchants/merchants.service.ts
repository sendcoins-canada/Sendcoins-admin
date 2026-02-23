import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Merchant {
  id: number;
  keychain: string;
  userName: string;
  email: string;
  phone: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankCode: string;
  verificationStatus: string;
  verificationDate: number | null;
  verifiedByAdmin: string | null;
  verificationNotes: string | null;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number | null;
}

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all merchants with pagination and filters
   */
  async getMerchants(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    active?: boolean;
  }) {
    const { page = 1, limit = 20, search, status, active } = params;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (
        user_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        bank_account_number ILIKE $${paramIndex} OR
        keychain ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereClause += ` AND verification_status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (active !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      queryParams.push(active);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM merchants ${whereClause}`;
    const countResult = await this.prisma.client.$queryRawUnsafe<
      Array<{ total: bigint }>
    >(countQuery, ...queryParams);

    const total = Number(countResult[0]?.total || 0);

    // Get merchants
    const merchantsQuery = `
      SELECT
        m_id as id,
        keychain,
        user_name,
        email,
        phone,
        bank_name,
        bank_account_name,
        bank_account_number,
        bank_code,
        verification_status,
        verification_date,
        verified_by_admin,
        verification_notes,
        total_order,
        completed_order,
        pending_order,
        is_active,
        created_at,
        updated_at
      FROM merchants
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const merchants = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: number;
        keychain: string;
        user_name: string;
        email: string;
        phone: string;
        bank_name: string;
        bank_account_name: string;
        bank_account_number: string;
        bank_code: string;
        verification_status: string;
        verification_date: bigint | null;
        verified_by_admin: string | null;
        verification_notes: string | null;
        total_order: number;
        completed_order: number;
        pending_order: number;
        is_active: boolean;
        created_at: bigint;
        updated_at: bigint | null;
      }>
    >(merchantsQuery, ...queryParams, limit, offset);

    return {
      merchants: merchants.map((m) => ({
        id: m.id,
        keychain: m.keychain,
        userName: m.user_name,
        email: m.email,
        phone: m.phone,
        bankName: m.bank_name,
        bankAccountName: m.bank_account_name,
        bankAccountNumber: m.bank_account_number,
        bankCode: m.bank_code,
        verificationStatus: m.verification_status,
        verificationDate: m.verification_date ? Number(m.verification_date) : null,
        verifiedByAdmin: m.verified_by_admin,
        verificationNotes: m.verification_notes,
        totalOrders: m.total_order || 0,
        completedOrders: m.completed_order || 0,
        pendingOrders: m.pending_order || 0,
        isActive: m.is_active,
        createdAt: Number(m.created_at),
        updatedAt: m.updated_at ? Number(m.updated_at) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get merchant statistics
   */
  async getStats() {
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE verification_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE verification_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE verification_status = 'suspended') as suspended,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COALESCE(SUM(total_order), 0) as total_orders,
        COALESCE(SUM(completed_order), 0) as completed_orders
      FROM merchants
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        total: bigint;
        pending: bigint;
        approved: bigint;
        rejected: bigint;
        suspended: bigint;
        active: bigint;
        total_orders: bigint;
        completed_orders: bigint;
      }>
    >(statsQuery);

    const stats = result[0];
    return {
      total: Number(stats?.total || 0),
      pending: Number(stats?.pending || 0),
      approved: Number(stats?.approved || 0),
      rejected: Number(stats?.rejected || 0),
      suspended: Number(stats?.suspended || 0),
      active: Number(stats?.active || 0),
      totalOrders: Number(stats?.total_orders || 0),
      completedOrders: Number(stats?.completed_orders || 0),
    };
  }

  /**
   * Get a single merchant by keychain
   */
  async getMerchant(keychain: string) {
    const query = `
      SELECT
        m_id as id,
        user_api_key,
        keychain,
        user_name,
        email,
        phone,
        bank_name,
        bank_account_name,
        bank_account_number,
        bank_code,
        verification_status,
        verification_date,
        verified_by_admin,
        verification_notes,
        total_order,
        completed_order,
        pending_order,
        is_active,
        ip_address,
        device,
        created_at,
        updated_at
      FROM merchants
      WHERE keychain = $1
      LIMIT 1
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: number;
        user_api_key: string;
        keychain: string;
        user_name: string;
        email: string;
        phone: string;
        bank_name: string;
        bank_account_name: string;
        bank_account_number: string;
        bank_code: string;
        verification_status: string;
        verification_date: bigint | null;
        verified_by_admin: string | null;
        verification_notes: string | null;
        total_order: number;
        completed_order: number;
        pending_order: number;
        is_active: boolean;
        ip_address: string;
        device: string;
        created_at: bigint;
        updated_at: bigint | null;
      }>
    >(query, keychain);

    if (result.length === 0) {
      return null;
    }

    const m = result[0];
    return {
      id: m.id,
      keychain: m.keychain,
      userName: m.user_name,
      email: m.email,
      phone: m.phone,
      bankName: m.bank_name,
      bankAccountName: m.bank_account_name,
      bankAccountNumber: m.bank_account_number,
      bankCode: m.bank_code,
      verificationStatus: m.verification_status,
      verificationDate: m.verification_date ? Number(m.verification_date) : null,
      verifiedByAdmin: m.verified_by_admin,
      verificationNotes: m.verification_notes,
      totalOrders: m.total_order || 0,
      completedOrders: m.completed_order || 0,
      pendingOrders: m.pending_order || 0,
      isActive: m.is_active,
      ipAddress: m.ip_address,
      device: m.device,
      createdAt: Number(m.created_at),
      updatedAt: m.updated_at ? Number(m.updated_at) : null,
    };
  }

  /**
   * Approve a merchant
   */
  async approveMerchant(keychain: string, adminId: number, notes?: string) {
    const merchant = await this.getMerchant(keychain);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = Math.floor(Date.now() / 1000);

    await this.prisma.client.$queryRawUnsafe(
      `UPDATE merchants SET
        verification_status = 'approved',
        verification_date = $1,
        verified_by_admin = $2,
        verification_notes = $3,
        updated_at = $1
      WHERE keychain = $4`,
      now,
      String(adminId),
      notes || null,
      keychain,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'MERCHANT_APPROVED',
        detail: {
          resourceType: 'MERCHANT',
          resourceId: keychain,
          merchantName: merchant.userName,
          email: merchant.email,
          notes,
        },
      },
    });

    return { success: true };
  }

  /**
   * Reject a merchant
   */
  async rejectMerchant(keychain: string, adminId: number, reason: string) {
    const merchant = await this.getMerchant(keychain);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = Math.floor(Date.now() / 1000);

    await this.prisma.client.$queryRawUnsafe(
      `UPDATE merchants SET
        verification_status = 'rejected',
        verification_date = $1,
        verified_by_admin = $2,
        verification_notes = $3,
        updated_at = $1
      WHERE keychain = $4`,
      now,
      String(adminId),
      reason,
      keychain,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'MERCHANT_REJECTED',
        detail: {
          resourceType: 'MERCHANT',
          resourceId: keychain,
          merchantName: merchant.userName,
          email: merchant.email,
          reason,
        },
      },
    });

    return { success: true };
  }

  /**
   * Suspend a merchant
   */
  async suspendMerchant(keychain: string, adminId: number, reason: string) {
    const merchant = await this.getMerchant(keychain);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = Math.floor(Date.now() / 1000);

    await this.prisma.client.$queryRawUnsafe(
      `UPDATE merchants SET
        verification_status = 'suspended',
        is_active = false,
        verification_notes = $1,
        updated_at = $2
      WHERE keychain = $3`,
      reason,
      now,
      keychain,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'MERCHANT_SUSPENDED',
        detail: {
          resourceType: 'MERCHANT',
          resourceId: keychain,
          merchantName: merchant.userName,
          email: merchant.email,
          reason,
        },
      },
    });

    return { success: true };
  }

  /**
   * Activate/Deactivate a merchant
   */
  async toggleMerchantStatus(keychain: string, adminId: number, isActive: boolean) {
    const merchant = await this.getMerchant(keychain);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const now = Math.floor(Date.now() / 1000);

    await this.prisma.client.$queryRawUnsafe(
      `UPDATE merchants SET
        is_active = $1,
        updated_at = $2
      WHERE keychain = $3`,
      isActive,
      now,
      keychain,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: isActive ? 'MERCHANT_ACTIVATED' : 'MERCHANT_DEACTIVATED',
        detail: {
          resourceType: 'MERCHANT',
          resourceId: keychain,
          merchantName: merchant.userName,
          email: merchant.email,
        },
      },
    });

    return { success: true, isActive };
  }

  /**
   * Get merchant's transaction history
   */
  async getMerchantTransactions(keychain: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const query = `
      SELECT
        history_id as id,
        reference,
        keychain as tx_keychain,
        user_api_key,
        asset_type,
        option_type,
        transaction_type,
        crypto_sign,
        crypto_amount,
        currency_sign,
        currency_amount,
        exchange_rate,
        payment_method,
        status,
        created_at
      FROM transaction_history
      WHERE merchant_keychain = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const transactions = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: number;
        reference: string;
        tx_keychain: string;
        user_api_key: string;
        asset_type: string;
        option_type: string;
        transaction_type: string;
        crypto_sign: string;
        crypto_amount: number;
        currency_sign: string;
        currency_amount: number;
        exchange_rate: number;
        payment_method: string;
        status: string;
        created_at: bigint;
      }>
    >(query, keychain, limit, offset);

    const countQuery = `SELECT COUNT(*) as total FROM transaction_history WHERE merchant_keychain = $1`;
    const countResult = await this.prisma.client.$queryRawUnsafe<
      Array<{ total: bigint }>
    >(countQuery, keychain);

    const total = Number(countResult[0]?.total || 0);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        keychain: tx.tx_keychain,
        assetType: tx.asset_type,
        optionType: tx.option_type,
        transactionType: tx.transaction_type,
        cryptoSign: tx.crypto_sign,
        cryptoAmount: tx.crypto_amount,
        currencySign: tx.currency_sign,
        currencyAmount: tx.currency_amount,
        exchangeRate: tx.exchange_rate,
        paymentMethod: tx.payment_method,
        status: tx.status,
        createdAt: Number(tx.created_at),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
