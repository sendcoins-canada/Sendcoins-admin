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
  total_balance: number | null; // Maps to crypto_balance in response
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
    // Pass parameters correctly - if params array is empty, don't spread it
    const countResult = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<[{ total: bigint }]>(countQuery);
    const total = Number(countResult[0]?.total || 0);

    const dataQuery = `
      SELECT wallet_id, wallet_address, total_balance, name, network, timestamp
      FROM ${tableName}
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    // Pass parameters correctly - params array + limit + offset
    const wallets = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<WalletRow[]>(dataQuery, ...params, limit, offset)
      : await this.prisma.client.$queryRawUnsafe<WalletRow[]>(dataQuery, limit, offset);

    return {
      wallets: wallets.map((w) => ({
        crypto: crypto.toUpperCase(),
        walletId: w.wallet_id,
        walletAddress: w.wallet_address,
        cryptoBalance: w.total_balance?.toString() || '0',
        fiatBalance: '0', // fiat_balance doesn't exist in schema
        userId: null, // azer_id doesn't exist in schema
        frozen: false, // freeze doesn't exist in schema
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
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Build filters using columns that may exist (will fail gracefully if they don't)
    if (filters.userId) {
      // Try using azer_id column (may not exist in all tables)
      conditions.push(`azer_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.address) {
      conditions.push(`wallet_address ILIKE $${paramIndex++}`);
      params.push(`%${filters.address}%`);
    }

    if (filters.frozen === 'true') {
      conditions.push(`freeze = 'yes'`);
    } else if (filters.frozen === 'false') {
      conditions.push(`(freeze IS NULL OR freeze != 'yes')`);
    }

    // Build WHERE clause only if we have conditions
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Try selecting columns that exist in schema first, with fallback for optional columns
    // Start with columns that definitely exist, then try optional ones
    const query = `SELECT wallet_id, wallet_address, total_balance, name, network, timestamp FROM ${tableName} ${whereClause}`.trim();

    // Pass parameters correctly
    // Note: Prisma $queryRawUnsafe signature is: (query: string, ...values: any[])
    // When no params, we must call with just the query string
    let wallets: WalletRow[];
    try {
      // Call with proper argument spreading
      wallets = params.length > 0
        ? await this.prisma.client.$queryRawUnsafe<WalletRow[]>(query, ...params)
        : await this.prisma.client.$queryRawUnsafe<WalletRow[]>(query);
    } catch (error: any) {
      // Enhanced error logging
      const errorDetails = {
        tableName,
        query: query.replace(/\s+/g, ' ').trim(),
        params,
        paramsLength: params.length,
        whereClause,
        errorMessage: error.message,
        errorCode: error.code,
      };
      console.error(`[WalletsService] Query error:`, errorDetails);
      
      // If it's a syntax error, try a simpler query to verify table exists
      if (error.code === '42601' || error.message?.includes('syntax error')) {
        try {
          const testQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
          const testResult = await this.prisma.client.$queryRawUnsafe<[{ count: bigint }]>(testQuery);
          console.error(`[WalletsService] Table exists, count: ${testResult[0]?.count}`);
        } catch (testError: any) {
          console.error(`[WalletsService] Test query also failed:`, testError.message);
        }
      }
      
      throw error;
    }

    return wallets.map((w) => ({
      crypto: cryptoType.toUpperCase(),
      walletId: w.wallet_id,
      walletAddress: w.wallet_address,
      cryptoBalance: w.total_balance?.toString() || '0',
      fiatBalance: '0', // fiat_balance doesn't exist in schema, default to 0
      userId: null, // azer_id column doesn't exist in schema
      frozen: false, // freeze column doesn't exist in schema
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

    // First, get the user's api_key from send_coin_user table
    const user = await this.prisma.client.send_coin_user.findUnique({
      where: { azer_id: userId },
      select: { api_key: true },
    });

    if (!user?.api_key) {
      return { userId, wallets };
    }

    // Find wallet addresses from transaction history where user was involved
    const userApiKey = user.api_key;

    // Get wallet addresses from wallet_transfers (where user sent or received)
    const transferWallets = await this.prisma.client.wallet_transfers.findMany({
      where: { user_api_key: userApiKey },
      select: {
        asset: true,
        recipient_wallet_address: true,
        network: true,
      },
      distinct: ['recipient_wallet_address'],
    });

    // Collect unique wallet addresses by crypto type from wallet_transfers
    // Note: transaction_history doesn't store wallet addresses, only wallet_transfers does
    const walletMap = new Map<string, Set<string>>();

    for (const tx of transferWallets) {
      if (tx.recipient_wallet_address && tx.asset) {
        const cryptoType = tx.asset.toUpperCase();
        if (!walletMap.has(cryptoType)) {
          walletMap.set(cryptoType, new Set());
        }
        walletMap.get(cryptoType)!.add(tx.recipient_wallet_address);
      }
    }

    // For each wallet address found, try to get wallet details from the wallet tables
    for (const [cryptoType, addresses] of walletMap) {
      const tableName = CRYPTO_TABLES[cryptoType as CryptoType];
      if (!tableName) continue;

      for (const address of addresses) {
        try {
          const query = `
            SELECT wallet_id, wallet_address, total_balance, name, network, timestamp, freeze
            FROM ${tableName}
            WHERE wallet_address = $1
            LIMIT 1
          `;
          const result = await this.prisma.client.$queryRawUnsafe<
            Array<WalletRow & { freeze?: string }>
          >(query, address);

          if (result.length > 0) {
            const w = result[0];
            wallets.push({
              crypto: cryptoType,
              walletId: w.wallet_id,
              walletAddress: w.wallet_address,
              cryptoBalance: w.total_balance?.toString() || '0',
              fiatBalance: '0',
              frozen: w.freeze === 'yes',
              network: w.network,
            });
          }
        } catch {
          // Wallet table query failed, skip this crypto type
          continue;
        }
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
