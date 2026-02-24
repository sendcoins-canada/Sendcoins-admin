import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FiatAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  currency: string;
  availableBalance: number;
  lockedBalance: number;
  actualBalance: number;
  userId: number;
  userEmail: string;
  userName: string;
  createdAt: string;
}

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all fiat accounts (wallet_accounts / CrayFi virtual accounts) with pagination and filters
   */
  async getAccounts(params: {
    page?: number;
    limit?: number;
    search?: string;
    country?: string;
    currency?: string;
  }) {
    const { page = 1, limit = 20, search, currency } = params;
    const offset = (page - 1) * limit;

    const where: Prisma.wallet_accountsWhereInput = {};

    if (currency) {
      where.currency = { equals: currency, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const term = search.trim();
      const searchConditions: Prisma.wallet_accountsWhereInput[] = [
        { account_number: { contains: term, mode: 'insensitive' } },
        { account_name: { contains: term, mode: 'insensitive' } },
        { bank_name: { contains: term, mode: 'insensitive' } },
      ];
      const usersMatchingSearch = await this.prisma.client.send_coin_user.findMany({
        where: {
          OR: [
            { user_email: { contains: term, mode: 'insensitive' } },
            { first_name: { contains: term, mode: 'insensitive' } },
            { last_name: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { api_key: true },
      });
      const matchingApiKeys = usersMatchingSearch.map((u) => u.api_key).filter(Boolean) as string[];
      if (matchingApiKeys.length > 0) {
        searchConditions.push({ wallet: { user_api_key: { in: matchingApiKeys } } });
      }
      where.OR = searchConditions;
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.wallet_accounts.count({ where }),
      this.prisma.client.wallet_accounts.findMany({
        where,
        include: { wallet: true },
        skip: offset,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const apiKeys = [...new Set(rows.map((r) => r.wallet.user_api_key).filter(Boolean))] as string[];
    const users =
      apiKeys.length > 0
        ? await this.prisma.client.send_coin_user.findMany({
            where: { api_key: { in: apiKeys } },
            select: { api_key: true, azer_id: true, user_email: true, first_name: true, last_name: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.api_key, u]));

    const accounts: FiatAccount[] = rows.map((wa) => {
      const u = wa.wallet.user_api_key ? userMap.get(wa.wallet.user_api_key) : null;
      return {
        id: wa.id,
        accountNumber: wa.account_number,
        accountName: wa.account_name,
        bankName: wa.bank_name,
        bankCode: wa.bank_code,
        currency: wa.currency,
        availableBalance: Number(wa.available_balance),
        lockedBalance: Number(wa.locked_balance),
        actualBalance: Number(wa.actual_balance),
        userId: u?.azer_id ?? 0,
        userEmail: u?.user_email ?? 'Unknown',
        userName: [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Unknown',
        createdAt: wa.created_at?.toISOString() ?? '',
      };
    });

    return {
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get fiat account statistics
   */
  async getStats() {
    const [total, walletsWithAccounts] = await Promise.all([
      this.prisma.client.wallet_accounts.count(),
      this.prisma.client.wallet_accounts.findMany({
        select: { wallet_id: true },
      }),
    ]);
    const uniqueWallets = new Set(walletsWithAccounts.map((w) => w.wallet_id)).size;
    const [currencies, banks] = await Promise.all([
      this.prisma.client.wallet_accounts.findMany({ select: { currency: true } }).then((r) => new Set(r.map((x) => x.currency)).size),
      this.prisma.client.wallet_accounts.findMany({ select: { bank_name: true } }).then((r) => new Set(r.map((x) => x.bank_name)).size),
    ]);

    return {
      total,
      uniqueUsers: uniqueWallets,
      countries: currencies,
      banks,
    };
  }

  /**
   * Get a single fiat account by id (UUID)
   */
  async getAccount(id: string) {
    const wa = await this.prisma.client.wallet_accounts.findFirst({
      where: { id },
      include: { wallet: true },
    });
    if (!wa) return null;

    let user: { azer_id: number; user_email: string | null; first_name: string | null; last_name: string | null } | null = null;
    if (wa.wallet.user_api_key) {
      user = await this.prisma.client.send_coin_user.findFirst({
        where: { api_key: wa.wallet.user_api_key },
        select: { azer_id: true, user_email: true, first_name: true, last_name: true },
      });
    }

    return {
      id: wa.id,
      accountNumber: wa.account_number,
      accountName: wa.account_name,
      bankName: wa.bank_name,
      bankCode: wa.bank_code,
      currency: wa.currency,
      availableBalance: Number(wa.available_balance),
      lockedBalance: Number(wa.locked_balance),
      actualBalance: Number(wa.actual_balance),
      userId: user?.azer_id ?? 0,
      userEmail: user?.user_email ?? 'Unknown',
      userName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Unknown',
      createdAt: wa.created_at?.toISOString() ?? '',
    };
  }

  /**
   * Get fiat accounts for a specific user (by azer_id)
   */
  async getUserAccounts(userId: number) {
    const user = await this.prisma.client.send_coin_user.findFirst({
      where: { azer_id: userId },
      select: { api_key: true },
    });
    if (!user?.api_key) return [];

    const wallet = await this.prisma.client.wallets.findFirst({
      where: { user_api_key: user.api_key },
    });
    if (!wallet) return [];

    const rows = await this.prisma.client.wallet_accounts.findMany({
      where: { wallet_id: wallet.id },
      orderBy: { created_at: 'asc' },
    });

    return rows.map((wa) => ({
      id: wa.id,
      accountNumber: wa.account_number,
      accountName: wa.account_name,
      bankName: wa.bank_name,
      bankCode: wa.bank_code,
      currency: wa.currency,
      availableBalance: Number(wa.available_balance),
      lockedBalance: Number(wa.locked_balance),
      actualBalance: Number(wa.actual_balance),
      createdAt: wa.created_at?.toISOString() ?? '',
    }));
  }

  /**
   * Delete a fiat account (admin action) - use with caution; CrayFi accounts are system-managed
   */
  async deleteAccount(id: string, adminId: number) {
    const account = await this.getAccount(id);
    if (!account) {
      throw new Error('Fiat account not found');
    }

    await this.prisma.client.wallet_accounts.delete({
      where: { id },
    });

    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'FIAT_ACCOUNT_DELETED',
        detail: {
          resourceType: 'FIAT_ACCOUNT',
          resourceId: id,
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
