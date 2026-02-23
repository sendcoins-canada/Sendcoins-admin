import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BankAccount {
  id: number;
  keychain: string;
  userId: number;
  userEmail: string;
  userName: string;
  country: string;
  currency: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  isVerified: boolean;
  isFlagged: boolean;
  flagReason?: string;
  createdAt: Date;
}

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all bank accounts with pagination and filters
   */
  async getAccounts(params: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
    flagged?: boolean;
  }) {
    const { page = 1, limit = 20, search, country, flagged } = params;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (
        ba.bank_account ILIKE $${paramIndex} OR
        ba.bank_account_name ILIKE $${paramIndex} OR
        ba.bank_name ILIKE $${paramIndex} OR
        u.user_email ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (country) {
      whereClause += ` AND ba.country ILIKE $${paramIndex}`;
      queryParams.push(country);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bank_account ba
      LEFT JOIN send_coin_user u ON ba.user_api_key = u.api_key
      ${whereClause}
    `;

    const countResult = await this.prisma.client.$queryRawUnsafe<
      Array<{ total: bigint }>
    >(countQuery, ...queryParams);

    const total = Number(countResult[0]?.total || 0);

    // Get accounts
    const accountsQuery = `
      SELECT
        ba.id,
        ba.keychain,
        ba.user_api_key,
        ba.country,
        ba.currency_iso3 as currency,
        ba.bank_name,
        ba.bank_account as account_number,
        ba.bank_account_name as account_name,
        ba.set_default,
        ba.timestamp as created_at,
        u.azer_id as user_id,
        u.user_email,
        u.first_name,
        u.last_name
      FROM bank_account ba
      LEFT JOIN send_coin_user u ON ba.user_api_key = u.api_key
      ${whereClause}
      ORDER BY ba.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const accounts = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: number;
        keychain: string;
        user_api_key: string;
        country: string;
        currency: string;
        bank_name: string;
        account_number: string;
        account_name: string;
        set_default: string | boolean;
        created_at: Date;
        user_id: number;
        user_email: string;
        first_name: string;
        last_name: string;
      }>
    >(accountsQuery, ...queryParams, limit, offset);

    return {
      accounts: accounts.map((acc) => ({
        id: acc.id,
        keychain: acc.keychain,
        userId: acc.user_id,
        userEmail: acc.user_email || 'Unknown',
        userName: [acc.first_name, acc.last_name].filter(Boolean).join(' ') || 'Unknown',
        country: acc.country,
        currency: acc.currency,
        bankName: acc.bank_name,
        accountNumber: acc.account_number,
        accountName: acc.account_name,
        isDefault: acc.set_default === 'true' || acc.set_default === true,
        isVerified: true, // Assume verified if in database
        isFlagged: false, // TODO: Add flag column to table
        createdAt: acc.created_at,
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
   * Get bank account statistics
   */
  async getStats() {
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT user_api_key) as unique_users,
        COUNT(DISTINCT country) as countries,
        COUNT(DISTINCT bank_name) as banks
      FROM bank_account
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        total: bigint;
        unique_users: bigint;
        countries: bigint;
        banks: bigint;
      }>
    >(statsQuery);

    const stats = result[0] || { total: 0, unique_users: 0, countries: 0, banks: 0 };

    return {
      total: Number(stats.total),
      uniqueUsers: Number(stats.unique_users),
      countries: Number(stats.countries),
      banks: Number(stats.banks),
    };
  }

  /**
   * Get a single bank account by keychain
   */
  async getAccount(keychain: string) {
    const query = `
      SELECT
        ba.id,
        ba.keychain,
        ba.user_api_key,
        ba.country,
        ba.currency_iso3 as currency,
        ba.bank_name,
        ba.bank_account as account_number,
        ba.bank_account_name as account_name,
        ba.set_default,
        ba.timestamp as created_at,
        u.azer_id as user_id,
        u.user_email,
        u.first_name,
        u.last_name,
        u.phone,
        u.verify_user as kyc_verified
      FROM bank_account ba
      LEFT JOIN send_coin_user u ON ba.user_api_key = u.api_key
      WHERE ba.keychain = $1
      LIMIT 1
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: number;
        keychain: string;
        user_api_key: string;
        country: string;
        currency: string;
        bank_name: string;
        account_number: string;
        account_name: string;
        set_default: string | boolean;
        created_at: Date;
        user_id: number;
        user_email: string;
        first_name: string;
        last_name: string;
        phone: string;
        kyc_verified: boolean;
      }>
    >(query, keychain);

    if (result.length === 0) {
      return null;
    }

    const acc = result[0];
    return {
      id: acc.id,
      keychain: acc.keychain,
      userId: acc.user_id,
      userEmail: acc.user_email || 'Unknown',
      userName: [acc.first_name, acc.last_name].filter(Boolean).join(' ') || 'Unknown',
      userPhone: acc.phone,
      userKycVerified: acc.kyc_verified || false,
      country: acc.country,
      currency: acc.currency,
      bankName: acc.bank_name,
      accountNumber: acc.account_number,
      accountName: acc.account_name,
      isDefault: acc.set_default === 'true' || acc.set_default === true,
      isVerified: true,
      isFlagged: false,
      createdAt: acc.created_at,
    };
  }

  /**
   * Get bank accounts for a specific user
   */
  async getUserAccounts(userId: number) {
    const query = `
      SELECT
        ba.id,
        ba.keychain,
        ba.country,
        ba.currency_iso3 as currency,
        ba.bank_name,
        ba.bank_account as account_number,
        ba.bank_account_name as account_name,
        ba.set_default,
        ba.timestamp as created_at
      FROM bank_account ba
      JOIN send_coin_user u ON ba.user_api_key = u.api_key
      WHERE u.azer_id = $1
      ORDER BY ba.set_default DESC, ba.timestamp ASC
    `;

    const accounts = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: number;
        keychain: string;
        country: string;
        currency: string;
        bank_name: string;
        account_number: string;
        account_name: string;
        set_default: string | boolean;
        created_at: Date;
      }>
    >(query, userId);

    return accounts.map((acc) => ({
      id: acc.id,
      keychain: acc.keychain,
      country: acc.country,
      currency: acc.currency,
      bankName: acc.bank_name,
      accountNumber: acc.account_number,
      accountName: acc.account_name,
      isDefault: acc.set_default === 'true' || acc.set_default === true,
      createdAt: acc.created_at,
    }));
  }

  /**
   * Delete a bank account (admin action)
   */
  async deleteAccount(keychain: string, adminId: number) {
    // First check if account exists
    const account = await this.getAccount(keychain);
    if (!account) {
      throw new Error('Bank account not found');
    }

    // Delete the account
    await this.prisma.client.$queryRawUnsafe(
      'DELETE FROM bank_account WHERE keychain = $1',
      keychain,
    );

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'BANK_ACCOUNT_DELETED',
        detail: {
          resourceType: 'BANK_ACCOUNT',
          resourceId: keychain,
          userId: account.userId,
          userEmail: account.userEmail,
          accountNumber: account.accountNumber,
          bankName: account.bankName,
        },
      },
    });

    return { success: true };
  }
}
