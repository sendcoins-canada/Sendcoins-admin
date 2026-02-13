import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetWalletsQueryDto, CryptoType } from './dto/get-wallets-query.dto';

// Map crypto type to table name
const CRYPTO_TABLES: Record<CryptoType, string> = {
  [CryptoType.BTC]: 'azer_btc_wallet',
  [CryptoType.ETH]: 'azer_eth_wallet',
  [CryptoType.BNB]: 'azer_bnb_wallet',
  [CryptoType.SOL]: 'azer_sol_wallet',
  [CryptoType.TRX]: 'azer_trx_wallet',
  [CryptoType.USDT]: 'azer_usdt_wallet',
  [CryptoType.USDC]: 'azer_usdc_wallet',
  [CryptoType.POL]: 'azer_pol_wallet',
  [CryptoType.LTC]: 'azer_ltc_wallet',
};

interface WalletRow {
  wallet_id: number;
  wallet_address: string | null;
  crypto_balance: string | null;
  fiat_balance: string | null;
  azer_id: number | null;
  freeze: string | null;
  name: string | null;
  network: string | null;
  timestamp: Date;
}

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetWalletsQueryDto) {
    const { page = 1, limit = 20, crypto, userId, address, frozen } = query;
    const offset = (page - 1) * limit;

    // If crypto type specified, query that specific table
    if (crypto) {
      return this.queryWalletTable(crypto, {
        userId,
        address,
        frozen,
        limit,
        offset,
        page,
      });
    }

    // Otherwise, query all wallet tables and combine results
    const allWallets: Array<{
      crypto: string;
      walletId: number;
      walletAddress: string | null;
      cryptoBalance: string;
      fiatBalance: string;
      userId: number | null;
      frozen: boolean;
      network: string | null;
      createdAt: Date;
    }> = [];

    for (const [cryptoType, tableName] of Object.entries(CRYPTO_TABLES)) {
      const wallets = await this.queryWalletTableRaw(tableName, cryptoType, {
        userId,
        address,
        frozen,
      });
      allWallets.push(...wallets);
    }

    // Sort by timestamp descending
    allWallets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const total = allWallets.length;
    const paginatedWallets = allWallets.slice(offset, offset + limit);

    return {
      wallets: paginatedWallets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async queryWalletTable(
    crypto: CryptoType,
    options: {
      userId?: number;
      address?: string;
      frozen?: string;
      limit: number;
      offset: number;
      page: number;
    },
  ) {
    const tableName = CRYPTO_TABLES[crypto];
    const { userId, address, frozen, limit, offset, page } = options;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (userId) {
      whereClause += ` AND azer_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (address) {
      whereClause += ` AND wallet_address ILIKE $${paramIndex++}`;
      params.push(`%${address}%`);
    }

    if (frozen === 'true') {
      whereClause += ` AND freeze = 'yes'`;
    } else if (frozen === 'false') {
      whereClause += ` AND (freeze IS NULL OR freeze != 'yes')`;
    }

    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const countResult = await this.prisma.client.$queryRawUnsafe<
      [{ total: bigint }]
    >(countQuery, ...params);
    const total = Number(countResult[0]?.total || 0);

    const dataQuery = `
      SELECT wallet_id, wallet_address, crypto_balance, fiat_balance, azer_id, freeze, name, network, timestamp
      FROM ${tableName}
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const wallets = await this.prisma.client.$queryRawUnsafe<WalletRow[]>(
      dataQuery,
      ...params,
      limit,
      offset,
    );

    return {
      wallets: wallets.map((w) => ({
        crypto: crypto.toUpperCase(),
        walletId: w.wallet_id,
        walletAddress: w.wallet_address,
        cryptoBalance: w.crypto_balance || '0',
        fiatBalance: w.fiat_balance || '0',
        userId: w.azer_id,
        frozen: w.freeze === 'yes',
        network: w.network,
        createdAt: w.timestamp,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async queryWalletTableRaw(
    tableName: string,
    cryptoType: string,
    filters: { userId?: number; address?: string; frozen?: string },
  ) {
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      whereClause += ` AND azer_id = $${paramIndex++}`;
      params.push(filters.userId);
    }

    if (filters.address) {
      whereClause += ` AND wallet_address ILIKE $${paramIndex++}`;
      params.push(`%${filters.address}%`);
    }

    if (filters.frozen === 'true') {
      whereClause += ` AND freeze = 'yes'`;
    } else if (filters.frozen === 'false') {
      whereClause += ` AND (freeze IS NULL OR freeze != 'yes')`;
    }

    const query = `
      SELECT wallet_id, wallet_address, crypto_balance, fiat_balance, azer_id, freeze, name, network, timestamp
      FROM ${tableName}
      ${whereClause}
    `;

    const wallets = await this.prisma.client.$queryRawUnsafe<WalletRow[]>(
      query,
      ...params,
    );

    return wallets.map((w) => ({
      crypto: cryptoType.toUpperCase(),
      walletId: w.wallet_id,
      walletAddress: w.wallet_address,
      cryptoBalance: w.crypto_balance || '0',
      fiatBalance: w.fiat_balance || '0',
      userId: w.azer_id,
      frozen: w.freeze === 'yes',
      network: w.network,
      createdAt: w.timestamp,
    }));
  }

  async getUserWallets(userId: number) {
    const wallets: Array<{
      crypto: string;
      walletId: number;
      walletAddress: string | null;
      cryptoBalance: string;
      fiatBalance: string;
      frozen: boolean;
      network: string | null;
    }> = [];

    for (const [cryptoType, tableName] of Object.entries(CRYPTO_TABLES)) {
      const query = `
        SELECT wallet_id, wallet_address, crypto_balance, fiat_balance, freeze, network
        FROM ${tableName}
        WHERE azer_id = $1
      `;

      const result = await this.prisma.client.$queryRawUnsafe<WalletRow[]>(
        query,
        userId,
      );

      for (const w of result) {
        wallets.push({
          crypto: cryptoType.toUpperCase(),
          walletId: w.wallet_id,
          walletAddress: w.wallet_address,
          cryptoBalance: w.crypto_balance || '0',
          fiatBalance: w.fiat_balance || '0',
          frozen: w.freeze === 'yes',
          network: w.network,
        });
      }
    }

    return { userId, wallets };
  }

  async freezeWallet(
    crypto: CryptoType,
    walletId: number,
    reason: string,
    adminId: number,
  ) {
    const tableName = CRYPTO_TABLES[crypto];

    // Check if wallet exists
    const checkQuery = `SELECT wallet_id, azer_id, freeze FROM ${tableName} WHERE wallet_id = $1`;
    const existing = await this.prisma.client.$queryRawUnsafe<
      Array<{
        wallet_id: number;
        azer_id: number | null;
        freeze: string | null;
      }>
    >(checkQuery, walletId);

    if (!existing.length) {
      throw new NotFoundException(
        `Wallet with ID ${walletId} not found in ${crypto} wallets`,
      );
    }

    // Update freeze status
    const updateQuery = `UPDATE ${tableName} SET freeze = 'yes' WHERE wallet_id = $1`;
    await this.prisma.client.$executeRawUnsafe(updateQuery, walletId);

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'WALLET_FROZEN',
        adminId,
        detail: {
          crypto,
          walletId,
          userId: existing[0].azer_id,
          reason,
        },
      },
    });

    return {
      success: true,
      message: `${crypto.toUpperCase()} wallet ${walletId} has been frozen`,
      reason,
    };
  }

  async unfreezeWallet(crypto: CryptoType, walletId: number, adminId: number) {
    const tableName = CRYPTO_TABLES[crypto];

    // Check if wallet exists
    const checkQuery = `SELECT wallet_id, azer_id, freeze FROM ${tableName} WHERE wallet_id = $1`;
    const existing = await this.prisma.client.$queryRawUnsafe<
      Array<{
        wallet_id: number;
        azer_id: number | null;
        freeze: string | null;
      }>
    >(checkQuery, walletId);

    if (!existing.length) {
      throw new NotFoundException(
        `Wallet with ID ${walletId} not found in ${crypto} wallets`,
      );
    }

    // Update freeze status
    const updateQuery = `UPDATE ${tableName} SET freeze = NULL WHERE wallet_id = $1`;
    await this.prisma.client.$executeRawUnsafe(updateQuery, walletId);

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'WALLET_UNFROZEN',
        adminId,
        detail: {
          crypto,
          walletId,
          userId: existing[0].azer_id,
        },
      },
    });

    return {
      success: true,
      message: `${crypto.toUpperCase()} wallet ${walletId} has been unfrozen`,
    };
  }

  async freezeAllUserWallets(userId: number, reason: string, adminId: number) {
    const results: Array<{ crypto: string; walletsUpdated: number }> = [];

    for (const [cryptoType, tableName] of Object.entries(CRYPTO_TABLES)) {
      const updateQuery = `UPDATE ${tableName} SET freeze = 'yes' WHERE azer_id = $1`;
      const result = await this.prisma.client.$executeRawUnsafe(
        updateQuery,
        userId,
      );
      results.push({
        crypto: cryptoType.toUpperCase(),
        walletsUpdated: result,
      });
    }

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'ALL_WALLETS_FROZEN',
        adminId,
        detail: {
          userId,
          reason,
          results,
        },
      },
    });

    return {
      success: true,
      message: `All wallets for user ${userId} have been frozen`,
      reason,
      results,
    };
  }

  async unfreezeAllUserWallets(userId: number, adminId: number) {
    const results: Array<{ crypto: string; walletsUpdated: number }> = [];

    for (const [cryptoType, tableName] of Object.entries(CRYPTO_TABLES)) {
      const updateQuery = `UPDATE ${tableName} SET freeze = NULL WHERE azer_id = $1`;
      const result = await this.prisma.client.$executeRawUnsafe(
        updateQuery,
        userId,
      );
      results.push({
        crypto: cryptoType.toUpperCase(),
        walletsUpdated: result,
      });
    }

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'ALL_WALLETS_UNFROZEN',
        adminId,
        detail: {
          userId,
          results,
        },
      },
    });

    return {
      success: true,
      message: `All wallets for user ${userId} have been unfrozen`,
      results,
    };
  }

  async getWalletStats() {
    const stats: Record<
      string,
      { total: number; frozen: number; totalBalance: string }
    > = {};

    for (const [cryptoType, tableName] of Object.entries(CRYPTO_TABLES)) {
      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN freeze = 'yes' THEN 1 END) as frozen,
          COALESCE(SUM(CAST(crypto_balance AS DECIMAL)), 0) as total_balance
        FROM ${tableName}
      `;

      const result =
        await this.prisma.client.$queryRawUnsafe<
          Array<{ total: bigint; frozen: bigint; total_balance: string | null }>
        >(query);

      stats[cryptoType.toUpperCase()] = {
        total: Number(result[0]?.total || 0),
        frozen: Number(result[0]?.frozen || 0),
        totalBalance: result[0]?.total_balance || '0',
      };
    }

    return stats;
  }
}
