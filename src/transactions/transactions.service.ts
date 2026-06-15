import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetTransactionsDto,
  TransactionType,
  SortBy,
  SortOrder,
} from './dto/get-transactions.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { FlagTransactionDto } from './dto/flag-transaction.dto';
import { BulkUpdateStatusDto, BulkFlagDto } from './dto/bulk-action.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';
import { ApproveTransactionDto } from './dto/approve-transaction.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import {
  UnifiedTransactionResponseDto,
  TransactionStatsResponseDto,
  PaginatedTransactionsResponseDto,
} from './dto/transaction-response.dto';
import {
  Prisma,
  AdminNotificationType,
  AdminNotificationPriority,
  Permission,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

// Types for transaction records
type TransactionHistoryRecord = Prisma.transaction_historyGetPayload<{
  include: { merchants: true };
}>;

type WalletTransferRecord = Prisma.wallet_transfersGetPayload<object>;

type FiatTransferRecord = Prisma.fiat_bank_transfersGetPayload<object>;

// Filter types for better type safety
interface TransactionFilter {
  status?: string | { in: string[] };
  created_at?: { gte?: bigint; lte?: bigint };
  OR?: Array<Record<string, unknown>>;
  asset_type?: string;
  asset?: string;
  history_id?: number;
  transfer_id?: number;
  fiat_transfer_id?: number;
  is_flagged?: boolean;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Get transaction statistics
   */
  async getStats(
    type?: TransactionType,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<TransactionStatsResponseDto> {
    const dateFilter = this.buildDateFilter(dateFrom, dateTo);

    // Get transaction_history stats
    const historyWhere = {
      ...dateFilter,
      ...(type === TransactionType.BUY_SELL && {}),
    };

    const [
      historyCompleted,
      historyPending,
      historyFailed,
      historyFlagged,
      historyTotalVolume,
    ] = await Promise.all([
      this.prisma.client.transaction_history.count({
        where: { ...historyWhere, status: 'completed' },
      }),
      this.prisma.client.transaction_history.count({
        where: { ...historyWhere, status: 'pending' },
      }),
      this.prisma.client.transaction_history.count({
        where: { ...historyWhere, status: 'failed' },
      }),
      this.prisma.client.transaction_history.count({
        where: { ...historyWhere, is_flagged: true },
      }),
      this.prisma.client.transaction_history.aggregate({
        where: historyWhere,
        _sum: {
          currency_amount: true,
          crypto_amount: true,
        },
      }),
    ]);

    // Get wallet_transfers stats
    const transferWhere = {
      ...dateFilter,
      ...(type === TransactionType.WALLET_TRANSFER && {}),
    };

    const [
      transferCompleted,
      transferPending,
      transferFailed,
      transferFlagged,
      transferTotalVolume,
    ] = await Promise.all([
      this.prisma.client.wallet_transfers.count({
        where: { ...transferWhere, status: 'completed' },
      }),
      this.prisma.client.wallet_transfers.count({
        where: { ...transferWhere, status: 'pending' },
      }),
      this.prisma.client.wallet_transfers.count({
        where: { ...transferWhere, status: 'failed' },
      }),
      this.prisma.client.wallet_transfers.count({
        where: { ...transferWhere, is_flagged: true },
      }),
      this.prisma.client.wallet_transfers.aggregate({
        where: transferWhere,
        _sum: {
          amount: true,
          fee: true,
        },
      }),
    ]);

    // Get fiat_bank_transfers stats
    const fiatWhere = {
      ...dateFilter,
      ...(type === TransactionType.FIAT_TRANSFER && {}),
    };

    const [
      fiatCompleted,
      fiatPending,
      fiatFailed,
      fiatFlagged,
      fiatTotalVolume,
    ] = await Promise.all([
      this.prisma.client.fiat_bank_transfers.count({
        where: { ...fiatWhere, status: 'completed' },
      }),
      this.prisma.client.fiat_bank_transfers.count({
        where: { ...fiatWhere, status: 'pending' },
      }),
      this.prisma.client.fiat_bank_transfers.count({
        where: { ...fiatWhere, status: 'failed' },
      }),
      this.prisma.client.fiat_bank_transfers.count({
        where: { ...fiatWhere, is_flagged: true },
      }),
      this.prisma.client.fiat_bank_transfers.aggregate({
        where: fiatWhere,
        _sum: {
          amount: true,
        },
      }),
    ]);

    // Count by type based on transaction_type field
    // In transaction_history: 'buy' = incoming (user receives crypto), 'sell' = outgoing
    const [historyIncoming, historyOutgoing] = await Promise.all([
      this.prisma.client.transaction_history.count({
        where: { ...historyWhere, transaction_type: 'buy', status: 'completed' },
      }),
      this.prisma.client.transaction_history.count({
        where: { ...historyWhere, transaction_type: 'sell', status: 'completed' },
      }),
    ]);

    // Wallet transfers and fiat transfers are typically outgoing from the user's perspective
    const incoming = historyIncoming;
    const outgoing = historyOutgoing + transferCompleted + fiatCompleted;
    const conversion = historyCompleted; // All buy/sell are conversions

    return {
      totalVolume: {
        crypto:
          Number(historyTotalVolume._sum.crypto_amount || 0) +
          Number(transferTotalVolume._sum.amount || 0),
        fiat:
          Number(historyTotalVolume._sum.currency_amount || 0) +
          Number(fiatTotalVolume._sum.amount || 0),
      },
      completed: historyCompleted + transferCompleted + fiatCompleted,
      pending: historyPending + transferPending + fiatPending,
      failed: historyFailed + transferFailed + fiatFailed,
      flagged: historyFlagged + transferFlagged + fiatFlagged,
      byType: {
        incoming,
        outgoing,
        conversion,
      },
    };
  }

  /**
   * Get unified list of transactions
   */
  async findAll(
    dto: GetTransactionsDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    const { page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    // Build filters
    const historyFilters = this.buildHistoryFilters(dto);
    const transferFilters = this.buildTransferFilters(dto);
    const fiatFilters = this.buildFiatFilters(dto);

    // Check if we should fetch from tables
    const fetchHistory =
      dto.type !== TransactionType.WALLET_TRANSFER &&
      dto.type !== TransactionType.FIAT_TRANSFER;
    const fetchTransfers =
      dto.type !== TransactionType.BUY_SELL &&
      dto.type !== TransactionType.FIAT_TRANSFER;
    const fetchFiat =
      dto.type !== TransactionType.BUY_SELL &&
      dto.type !== TransactionType.WALLET_TRANSFER;

    // Get counts
    const [historyCount, transferCount, fiatCount] = await Promise.all([
      fetchHistory
        ? this.prisma.client.transaction_history.count({
            where: historyFilters,
          })
        : Promise.resolve(0),
      fetchTransfers
        ? this.prisma.client.wallet_transfers.count({ where: transferFilters })
        : Promise.resolve(0),
      fetchFiat
        ? this.prisma.client.fiat_bank_transfers.count({ where: fiatFilters })
        : Promise.resolve(0),
    ]);

    // Count new tables (raw SQL since no Prisma model)
    let withdrawalCount = 0;
    let buyCount = 0;
    let cryptoFiatCount = 0;
    try {
      const [wdC, buyC, cfC] = await Promise.all([
        this.prisma.client.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM withdrawals'),
        this.prisma.client.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM fiat_crypto_conversions'),
        this.prisma.client.$queryRawUnsafe<[{count: bigint}]>('SELECT COUNT(*) as count FROM crypto_fiat_conversions'),
      ]);
      withdrawalCount = Number(wdC[0]?.count || 0);
      buyCount = Number(buyC[0]?.count || 0);
      cryptoFiatCount = Number(cfC[0]?.count || 0);
    } catch { /* tables may not exist yet */ }

    const total = historyCount + transferCount + fiatCount + withdrawalCount + buyCount + cryptoFiatCount;
    const totalPages = Math.ceil(total / limit);

    // Fetch transactions with a reasonable buffer to account for unified sorting
    // For better performance with very large datasets (>10k records), consider:
    // 1. Cursor-based pagination
    // 2. Database views/union queries
    // 3. Separate endpoints for each transaction type
    const fetchLimit = Math.min(
      limit + skip + limit * 0.5, // Fetch extra to account for sorting
      Math.max(limit * 3, 500), // But cap at reasonable limit
    );

    const [historyTransactions, transferTransactions, fiatTransactions] =
      await Promise.all([
        fetchHistory && historyCount > 0
          ? this.prisma.client.transaction_history.findMany({
              where: historyFilters,
              take: fetchTransfers || fetchFiat ? fetchLimit : limit + skip,
              orderBy: this.buildOrderBy(dto, 'history'),
              include: {
                merchants: true,
              },
            })
          : Promise.resolve([]),
        fetchTransfers && transferCount > 0
          ? this.prisma.client.wallet_transfers.findMany({
              where: transferFilters,
              take: fetchHistory || fetchFiat ? fetchLimit : limit + skip,
              orderBy: this.buildOrderBy(dto, 'transfer'),
            })
          : Promise.resolve([]),
        fetchFiat && fiatCount > 0
          ? this.prisma.client.fiat_bank_transfers.findMany({
              where: fiatFilters,
              take: fetchHistory || fetchTransfers ? fetchLimit : limit + skip,
              orderBy: this.buildOrderBy(dto, 'fiat'),
            })
          : Promise.resolve([]),
      ]);

    // Fetch withdrawals (crypto-to-NGN)
    let withdrawalTransactions: UnifiedTransactionResponseDto[] = [];
    try {
      const withdrawalRows = await this.prisma.client.$queryRawUnsafe<Array<{
        id: string; reference: string; user_api_key: string;
        source_asset: string; source_network: string; source_amount: string;
        ngn_amount: string; platform_fee_crypto: string; strategy: string;
        status: string; onchain_tx_hash: string | null; failure_reason: string | null;
        created_at: Date; completed_at: Date | null;
      }>>(
        `SELECT id, reference, user_api_key, source_asset, source_network, source_amount,
                ngn_amount, platform_fee_crypto, strategy, status, onchain_tx_hash,
                failure_reason, created_at, completed_at
         FROM withdrawals ORDER BY created_at DESC LIMIT $1`,
        fetchLimit
      );
      withdrawalTransactions = withdrawalRows.map((wd) => ({
        id: 0,
        txId: wd.reference,
        reference: wd.reference,
        type: 'OUTGOING' as const,
        transactionCategory: 'WITHDRAWAL',
        dateInitiated: new Date(wd.created_at),
        currency: { crypto: wd.source_asset, fiat: 'NGN', display: wd.source_asset },
        amount: { crypto: Number(wd.source_amount), fiat: Number(wd.ngn_amount), display: `${wd.source_amount} ${wd.source_asset} → ${wd.ngn_amount} NGN` },
        fee: Number(wd.platform_fee_crypto),
        status: wd.status === 'completed' ? 'completed' : wd.status === 'ngn_credit_failed' ? 'failed' : wd.status,
        isFlagged: false,
        source: { address: wd.user_api_key, type: 'WALLET' },
        destination: { address: 'NGN Wallet', type: 'WALLET', name: 'NGN Wallet', network: wd.source_network },
        txHash: wd.onchain_tx_hash ?? undefined,
        network: wd.source_network,
        notes: `Strategy: ${wd.strategy || 'N/A'}`,
        createdAt: new Date(wd.created_at),
        updatedAt: wd.completed_at ? new Date(wd.completed_at) : undefined,
      }));
    } catch { /* table may not exist yet */ }

    // Fetch fiat-to-crypto buys
    let buyTransactions: UnifiedTransactionResponseDto[] = [];
    try {
      const buyRows = await this.prisma.client.$queryRawUnsafe<Array<{
        conversion_id: number; reference: string; keychain: string;
        user_api_key: string; user_email: string;
        source_currency: string; source_amount: string;
        destination_asset: string; destination_network: string; destination_amount: string;
        platform_fee_fiat: string; platform_fee_usd: string; status: string;
        created_at_timestamp: Date | null; completed_at: bigint | null;
      }>>(
        `SELECT conversion_id, reference, keychain, user_api_key, user_email,
                source_currency, source_amount, destination_asset, destination_network,
                destination_amount, platform_fee_fiat, platform_fee_usd, status, created_at_timestamp, completed_at
         FROM fiat_crypto_conversions ORDER BY created_at DESC LIMIT $1`,
        fetchLimit
      );
      buyTransactions = buyRows.map((buy) => ({
        id: buy.conversion_id,
        txId: buy.keychain,
        reference: buy.reference,
        type: 'INCOMING' as const,
        transactionCategory: 'FIAT_CRYPTO_BUY',
        dateInitiated: buy.created_at_timestamp ? new Date(buy.created_at_timestamp) : new Date(),
        currency: { crypto: buy.destination_asset, fiat: buy.source_currency, display: buy.destination_asset },
        amount: { crypto: Number(buy.destination_amount), fiat: Number(buy.source_amount), display: `${buy.destination_amount} ${buy.destination_asset}` },
        fee: Number(buy.platform_fee_usd || 0),
        status: buy.status || 'pending',
        isFlagged: false,
        source: { address: `${buy.source_currency} Wallet`, type: 'WALLET' as const, name: `${buy.source_amount} ${buy.source_currency}` },
        destination: { address: buy.user_api_key || 'N/A', type: 'WALLET' as const, name: `${buy.destination_asset} Wallet`, network: buy.destination_network },
        notes: `Bought with ${buy.source_amount} ${buy.source_currency} (fee: ${buy.platform_fee_fiat} ${buy.source_currency})`,
        network: buy.destination_network,
        createdAt: buy.created_at_timestamp ? new Date(buy.created_at_timestamp) : new Date(),
        updatedAt: buy.completed_at ? new Date(Number(buy.completed_at) * 1000) : undefined,
      }));
    } catch { /* table may not exist yet */ }

    // Fetch crypto-to-fiat conversions
    let cryptoFiatTransactions: UnifiedTransactionResponseDto[] = [];
    try {
      const convRows = await this.prisma.client.$queryRawUnsafe<Array<{
        conversion_id: number; reference: string; keychain: string;
        user_api_key: string; user_email: string;
        source_asset: string; source_network: string; source_amount: string;
        destination_currency: string; destination_amount: string; final_fiat_amount: string;
        platform_fee_amount: string; status: string;
        created_at_timestamp: Date | null; completed_at: bigint | null;
      }>>(
        `SELECT conversion_id, reference, keychain, user_api_key, user_email,
                source_asset, source_network, source_amount,
                destination_currency, destination_amount, final_fiat_amount,
                platform_fee_amount, status, created_at_timestamp, completed_at
         FROM crypto_fiat_conversions ORDER BY created_at DESC LIMIT $1`,
        fetchLimit
      );
      cryptoFiatTransactions = convRows.map((conv) => ({
        id: conv.conversion_id,
        txId: conv.keychain,
        reference: conv.reference,
        type: 'CONVERSION' as const,
        transactionCategory: 'CRYPTO_FIAT_CONVERSION',
        dateInitiated: conv.created_at_timestamp ? new Date(conv.created_at_timestamp) : new Date(),
        currency: { crypto: conv.source_asset, fiat: conv.destination_currency, display: conv.source_asset },
        amount: { crypto: Number(conv.source_amount), fiat: Number(conv.final_fiat_amount || conv.destination_amount), display: `${conv.source_amount} ${conv.source_asset} → ${conv.final_fiat_amount || conv.destination_amount} ${conv.destination_currency}` },
        fee: Number(conv.platform_fee_amount || 0),
        status: conv.status || 'pending',
        isFlagged: false,
        source: { address: conv.user_api_key, type: 'WALLET', name: conv.user_email },
        destination: { address: `${conv.destination_currency} Wallet`, type: 'WALLET', name: `${conv.destination_currency} Wallet`, network: conv.source_network },
        network: conv.source_network,
        createdAt: conv.created_at_timestamp ? new Date(conv.created_at_timestamp) : new Date(),
        updatedAt: conv.completed_at ? new Date(Number(conv.completed_at) * 1000) : undefined,
      }));
    } catch { /* table may not exist yet */ }

    // Transform and combine
    const unifiedTransactions = [
      ...historyTransactions.map((t) => this.transformHistoryTransaction(t)),
      ...transferTransactions.map((t) => this.transformTransferTransaction(t)),
      ...fiatTransactions.map((t) => this.transformFiatTransaction(t)),
      ...withdrawalTransactions,
      ...buyTransactions,
      ...cryptoFiatTransactions,
    ];

    // Sort unified transactions
    unifiedTransactions.sort((a, b) => {
      if (dto.sortBy === SortBy.AMOUNT) {
        const aAmount = a.amount.crypto || a.amount.fiat || 0;
        const bAmount = b.amount.crypto || b.amount.fiat || 0;
        return dto.sortOrder === SortOrder.ASC
          ? aAmount - bAmount
          : bAmount - aAmount;
      }

      if (dto.sortBy === SortBy.STATUS) {
        const statusOrder = [
          'pending',
          'processing',
          'completed',
          'failed',
          'cancelled',
        ];
        const aIndex = statusOrder.indexOf(a.status) || 0;
        const bIndex = statusOrder.indexOf(b.status) || 0;
        return dto.sortOrder === SortOrder.ASC
          ? aIndex - bIndex
          : bIndex - aIndex;
      }

      // Default: sort by created_at
      if (dto.sortOrder === SortOrder.ASC) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Apply pagination to sorted results
    const paginatedTransactions = unifiedTransactions.slice(skip, skip + limit);

    return {
      data: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get transactions pending admin approval (pending + pending_funding).
   */
  async findAllPendingApprovals(
    dto: Omit<GetTransactionsDto, 'status'>,
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.findAll({
      ...dto,
      // Override status filter — buildTransferFilters will use { in: [...] }
      status: '__pending_approvals__' as any,
    });
  }

  /**
   * Get single transaction by ID
   */
  async findOne(
    id: number,
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ): Promise<UnifiedTransactionResponseDto> {
    if (type === 'transaction_history' || !type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
          include: { merchants: true },
        });

      if (transaction) {
        return this.transformHistoryTransaction(transaction);
      }
    }

    if (type === 'wallet_transfer' || !type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        return this.transformTransferTransaction(transaction);
      }
    }

    if (type === 'fiat_transfer' || !type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        return this.transformFiatTransaction(transaction);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    id: number,
    dto: UpdateTransactionStatusDto,
    adminId: number,
  ): Promise<UnifiedTransactionResponseDto> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (dto.type === 'transaction_history' || !dto.type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: {
            status: dto.status,
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes: dto.notes,
          },
          include: { merchants: true },
        });

        return this.transformHistoryTransaction(updated);
      }
    }

    if (dto.type === 'wallet_transfer' || !dto.type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        const updated = await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: {
            status: dto.status,
            updated_at: BigInt(Date.now()),
          },
        });

        return this.transformTransferTransaction(updated);
      }
    }

    if (dto.type === 'fiat_transfer' || !dto.type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.fiat_bank_transfers.update({
          where: { id: id },
          data: {
            status: dto.status,
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes: dto.notes,
            updated_at: BigInt(Date.now()),
          },
        });

        return this.transformFiatTransaction(updated);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Flag a transaction
   */
  async flagTransaction(
    id: number,
    dto: FlagTransactionDto,
    adminId: number,
  ): Promise<UnifiedTransactionResponseDto> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (dto.type === 'transaction_history' || !dto.type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: {
            is_flagged: true,
            flagged_at: BigInt(Date.now()),
            flagged_by: admin.email,
            flagged_reason: dto.reason,
          },
          include: { merchants: true },
        });

        // Notify admins with VERIFY_TRANSACTIONS permission
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_FLAGGED,
          'Transaction Flagged for Review',
          `Transaction ${transaction.reference} has been flagged by ${admin.email}. Reason: ${dto.reason}`,
          {
            priority: AdminNotificationPriority.HIGH,
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              flaggedBy: admin.email,
              reason: dto.reason,
            },
            actionUrl: `/transactions/${id}`,
            sendEmail: true,
          },
        );

        return this.transformHistoryTransaction(updated);
      }
    }

    if (dto.type === 'wallet_transfer' || !dto.type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        const updated = await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: {
            is_flagged: true,
            flagged_at: BigInt(Date.now()),
            flagged_by: admin.email,
            flagged_reason: dto.reason,
          },
        });

        // Notify admins with VERIFY_TRANSACTIONS permission
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_FLAGGED,
          'Wallet Transfer Flagged for Review',
          `Wallet transfer ${transaction.reference} has been flagged by ${admin.email}. Reason: ${dto.reason}`,
          {
            priority: AdminNotificationPriority.HIGH,
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              flaggedBy: admin.email,
              reason: dto.reason,
            },
            actionUrl: `/transactions/${id}`,
            sendEmail: true,
          },
        );

        return this.transformTransferTransaction(updated);
      }
    }

    if (dto.type === 'fiat_transfer' || !dto.type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.fiat_bank_transfers.update({
          where: { id: id },
          data: {
            is_flagged: true,
            flagged_at: BigInt(Date.now()),
            flagged_by: admin.email,
            flagged_reason: dto.reason,
          },
        });

        // Notify admins with VERIFY_TRANSACTIONS permission
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_FLAGGED,
          'Fiat Transfer Flagged for Review',
          `Fiat transfer ${transaction.reference} has been flagged by ${admin.email}. Reason: ${dto.reason}`,
          {
            priority: AdminNotificationPriority.HIGH,
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              flaggedBy: admin.email,
              reason: dto.reason,
            },
            actionUrl: `/transactions/${id}`,
            sendEmail: true,
          },
        );

        return this.transformFiatTransaction(updated);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Unflag a transaction
   */
  async unflagTransaction(
    id: number,
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ): Promise<UnifiedTransactionResponseDto> {
    if (type === 'transaction_history' || !type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: {
            is_flagged: false,
            flagged_at: null,
            flagged_by: null,
            flagged_reason: null,
          },
          include: { merchants: true },
        });

        return this.transformHistoryTransaction(updated);
      }
    }

    if (type === 'wallet_transfer' || !type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        const updated = await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: {
            is_flagged: false,
            flagged_at: null,
            flagged_by: null,
            flagged_reason: null,
          },
        });

        return this.transformTransferTransaction(updated);
      }
    }

    if (type === 'fiat_transfer' || !type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.fiat_bank_transfers.update({
          where: { id: id },
          data: {
            is_flagged: false,
            flagged_at: null,
            flagged_by: null,
            flagged_reason: null,
          },
        });

        return this.transformFiatTransaction(updated);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Bulk update status
   */
  async bulkUpdateStatus(
    dto: BulkUpdateStatusDto,
    adminId: number,
  ): Promise<{
    updated: number;
    failed: Array<{ id: number; error: string }>;
  }> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    const results = {
      updated: 0,
      failed: [] as Array<{ id: number; error: string }>,
    };

    for (const { id, type } of dto.transactionIds) {
      try {
        if (type === 'transaction_history') {
          await this.prisma.client.transaction_history.update({
            where: { history_id: id },
            data: {
              status: dto.status,
              status_updated_by: admin.email,
              status_updated_at: BigInt(Date.now()),
              status_notes: dto.notes,
            },
          });
        } else if (type === 'wallet_transfer') {
          await this.prisma.client.wallet_transfers.update({
            where: { transfer_id: id },
            data: {
              status: dto.status,
              updated_at: BigInt(Date.now()),
            },
          });
        } else if (type === 'fiat_transfer') {
          await this.prisma.client.fiat_bank_transfers.update({
            where: { id: id },
            data: {
              status: dto.status,
              status_updated_by: admin.email,
              status_updated_at: BigInt(Date.now()),
              status_notes: dto.notes,
              updated_at: BigInt(Date.now()),
            },
          });
        }
        results.updated++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ id, error: errorMessage });
      }
    }

    return results;
  }

  /**
   * Bulk flag transactions
   */
  async bulkFlag(
    dto: BulkFlagDto,
    adminId: number,
  ): Promise<{
    flagged: number;
    failed: Array<{ id: number; error: string }>;
  }> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    const results = {
      flagged: 0,
      failed: [] as Array<{ id: number; error: string }>,
    };

    for (const { id, type } of dto.transactionIds) {
      try {
        if (type === 'transaction_history') {
          await this.prisma.client.transaction_history.update({
            where: { history_id: id },
            data: {
              is_flagged: true,
              flagged_at: BigInt(Date.now()),
              flagged_by: admin.email,
              flagged_reason: dto.reason,
            },
          });
        } else if (type === 'wallet_transfer') {
          await this.prisma.client.wallet_transfers.update({
            where: { transfer_id: id },
            data: {
              is_flagged: true,
              flagged_at: BigInt(Date.now()),
              flagged_by: admin.email,
              flagged_reason: dto.reason,
            },
          });
        } else if (type === 'fiat_transfer') {
          await this.prisma.client.fiat_bank_transfers.update({
            where: { id: id },
            data: {
              is_flagged: true,
              flagged_at: BigInt(Date.now()),
              flagged_by: admin.email,
              flagged_reason: dto.reason,
            },
          });
        }
        results.flagged++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ id, error: errorMessage });
      }
    }

    return results;
  }

  /**
   * Verify transaction with transaction hash
   */
  async verifyTransaction(
    id: number,
    dto: VerifyTransactionDto,
    adminId: number,
  ): Promise<UnifiedTransactionResponseDto> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (dto.type === 'transaction_history' || !dto.type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: {
            status: 'completed',
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes:
              dto.notes || `Transaction verified with hash: ${dto.txHash}`,
          },
          include: { merchants: true },
        });

        // Notify about verification
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_APPROVED,
          'Transaction Verified',
          `Transaction ${transaction.reference} has been verified by ${admin.email}.`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              verifiedBy: admin.email,
            },
            sendEmail: false,
          },
        );

        return this.transformHistoryTransaction(updated);
      }
    }

    if (dto.type === 'wallet_transfer' || !dto.type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        // Verify that the provided hash matches the transaction hash
        if (transaction.tx_hash && transaction.tx_hash !== dto.txHash) {
          throw new BadRequestException('Transaction hash does not match');
        }

        const updated = await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: {
            status: 'completed',
            tx_hash: dto.txHash,
            updated_at: BigInt(Date.now()),
          },
        });

        // Notify about verification
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_APPROVED,
          'Wallet Transfer Verified',
          `Wallet transfer ${transaction.reference} has been verified by ${admin.email}.`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              verifiedBy: admin.email,
            },
            sendEmail: false,
          },
        );

        return this.transformTransferTransaction(updated);
      }
    }

    if (dto.type === 'fiat_transfer' || !dto.type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.fiat_bank_transfers.update({
          where: { id: id },
          data: {
            status: 'completed',
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes:
              dto.notes ||
              `Transaction verified with reference: ${transaction.reference}`,
            updated_at: BigInt(Date.now()),
          },
        });

        // Notify about verification
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_APPROVED,
          'Fiat Transfer Verified',
          `Fiat transfer ${transaction.reference} has been verified by ${admin.email}.`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              verifiedBy: admin.email,
            },
            sendEmail: false,
          },
        );

        return this.transformFiatTransaction(updated);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Approve a transaction
   */
  async approveTransaction(
    id: number,
    dto: ApproveTransactionDto,
    adminId: number,
  ): Promise<UnifiedTransactionResponseDto> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (dto.type === 'transaction_history' || !dto.type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: {
            status: 'completed',
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes: dto.notes || 'Transaction approved',
            ...(dto.txHash ? { tx_hash: dto.txHash } : {}),
          },
          include: { merchants: true },
        });

        // Notify about approval
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_APPROVED,
          'Transaction Approved',
          `Transaction ${transaction.reference} has been approved by ${admin.email}.`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              approvedBy: admin.email,
            },
            sendEmail: false,
          },
        );

        return this.transformHistoryTransaction(updated);
      }
    }

    if (dto.type === 'wallet_transfer' || !dto.type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        // If this was a pending_funding transfer, call the simulator to deduct locked balance
        if (transaction.status === 'pending_funding') {
          const simulatorUrl = process.env.TX_SIMULATOR_URL || 'http://localhost:4100';
          const simulatorSecret = process.env.TX_SIMULATOR_SECRET;
          try {
            const axios = require('axios');
            await axios.post(`${simulatorUrl}/api/transfer/resolve`, {
              reference: transaction.reference,
              txHash: dto.txHash || '',
            }, {
              timeout: 15000,
              headers: simulatorSecret ? { 'x-api-secret': simulatorSecret } : {},
              validateStatus: () => true,
            });
          } catch (err) {
            // Log but don't block approval — admin can fix manually
            console.error(`[APPROVE] Failed to resolve simulator transfer ${transaction.reference}: ${(err as Error).message}`);
          }
        }

        const updated = await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: {
            status: 'completed',
            tx_hash: dto.txHash || transaction.tx_hash,
            updated_at: BigInt(Date.now()),
          },
        });

        // Notify about approval
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_APPROVED,
          'Wallet Transfer Approved',
          `Wallet transfer ${transaction.reference} has been approved by ${admin.email}.`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              approvedBy: admin.email,
            },
            sendEmail: false,
          },
        );

        return this.transformTransferTransaction(updated);
      }
    }

    if (dto.type === 'fiat_transfer' || !dto.type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.fiat_bank_transfers.update({
          where: { id: id },
          data: {
            status: 'completed',
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes: dto.notes || 'Transaction approved',
            updated_at: BigInt(Date.now()),
            ...(dto.txHash ? { onchain_tx_hash: dto.txHash } : {}),
          },
        });

        // Notify about approval
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_APPROVED,
          'Fiat Transfer Approved',
          `Fiat transfer ${transaction.reference} has been approved by ${admin.email}.`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              approvedBy: admin.email,
            },
            sendEmail: false,
          },
        );

        return this.transformFiatTransaction(updated);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Update the transaction hash for any transaction (post-approval correction)
   */
  async updateTxHash(
    id: number,
    txHash: string,
    adminId: number,
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ): Promise<{ success: boolean; message: string; txHash: string }> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new BadRequestException('Admin user not found');

    if (type === 'transaction_history' || !type) {
      const tx = await this.prisma.client.transaction_history.findUnique({
        where: { history_id: id },
      });
      if (tx) {
        await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: { tx_hash: txHash, updated_at: BigInt(Date.now()) },
        });
        await this.prisma.client.adminAuditLog.create({
          data: {
            action: 'TRANSACTION_HASH_UPDATED',
            adminId,
            detail: { transactionId: id, txHash, updatedBy: admin.email },
          },
        });
        return { success: true, message: 'Transaction hash updated', txHash };
      }
    }

    if (type === 'wallet_transfer' || !type) {
      const tx = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });
      if (tx) {
        await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: { tx_hash: txHash, updated_at: BigInt(Date.now()) },
        });
        await this.prisma.client.adminAuditLog.create({
          data: {
            action: 'TRANSACTION_HASH_UPDATED',
            adminId,
            detail: { transactionId: id, txHash, updatedBy: admin.email },
          },
        });
        return { success: true, message: 'Transaction hash updated', txHash };
      }
    }

    if (type === 'fiat_transfer' || !type) {
      const tx = await this.prisma.client.fiat_bank_transfers.findUnique({
        where: { id },
      });
      if (tx) {
        await this.prisma.client.fiat_bank_transfers.update({
          where: { id },
          data: { onchain_tx_hash: txHash, updated_at: BigInt(Date.now()) },
        });
        await this.prisma.client.adminAuditLog.create({
          data: {
            action: 'TRANSACTION_HASH_UPDATED',
            adminId,
            detail: { transactionId: id, txHash, updatedBy: admin.email },
          },
        });
        return { success: true, message: 'Transaction hash updated', txHash };
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Cancel a transaction
   */
  async cancelTransaction(
    id: number,
    dto: CancelTransactionDto,
    adminId: number,
  ): Promise<UnifiedTransactionResponseDto> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (dto.type === 'transaction_history' || !dto.type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.transaction_history.update({
          where: { history_id: id },
          data: {
            status: 'cancelled',
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes: dto.reason || 'Transaction cancelled',
          },
          include: { merchants: true },
        });

        // Notify about cancellation
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_REJECTED,
          'Transaction Cancelled',
          `Transaction ${transaction.reference} has been cancelled by ${admin.email}. Reason: ${dto.reason || 'Not specified'}`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              cancelledBy: admin.email,
              reason: dto.reason,
            },
            sendEmail: false,
          },
        );

        return this.transformHistoryTransaction(updated);
      }
    }

    if (dto.type === 'wallet_transfer' || !dto.type) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
      });

      if (transaction) {
        // If this was a pending_funding transfer, call the simulator to unlock the locked balance
        if (transaction.status === 'pending_funding') {
          const simulatorUrl = process.env.TX_SIMULATOR_URL || 'http://localhost:4100';
          const simulatorSecret = process.env.TX_SIMULATOR_SECRET;
          try {
            const axios = require('axios');
            await axios.post(`${simulatorUrl}/api/transfer/cancel`, {
              reference: transaction.reference,
            }, {
              timeout: 15000,
              headers: simulatorSecret ? { 'x-api-secret': simulatorSecret } : {},
              validateStatus: () => true,
            });
          } catch (err) {
            console.error(`[CANCEL] Failed to cancel simulator transfer ${transaction.reference}: ${(err as Error).message}`);
          }
        }

        const updated = await this.prisma.client.wallet_transfers.update({
          where: { transfer_id: id },
          data: {
            status: 'cancelled',
            updated_at: BigInt(Date.now()),
          },
        });

        // Notify about cancellation
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_REJECTED,
          'Wallet Transfer Cancelled',
          `Wallet transfer ${transaction.reference} has been cancelled by ${admin.email}. Reason: ${dto.reason || 'Not specified'}`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              cancelledBy: admin.email,
              reason: dto.reason,
            },
            sendEmail: false,
          },
        );

        return this.transformTransferTransaction(updated);
      }
    }

    if (dto.type === 'fiat_transfer' || !dto.type) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
        });

      if (transaction) {
        const updated = await this.prisma.client.fiat_bank_transfers.update({
          where: { id: id },
          data: {
            status: 'cancelled',
            status_updated_by: admin.email,
            status_updated_at: BigInt(Date.now()),
            status_notes: dto.reason || 'Transaction cancelled',
            updated_at: BigInt(Date.now()),
          },
        });

        // Notify about cancellation
        await this.notifications.notifyAdminsByPermission(
          Permission.VERIFY_TRANSACTIONS,
          AdminNotificationType.TRANSACTION_REJECTED,
          'Fiat Transfer Cancelled',
          `Fiat transfer ${transaction.reference} has been cancelled by ${admin.email}. Reason: ${dto.reason || 'Not specified'}`,
          {
            metadata: {
              transactionId: id,
              transactionReference: transaction.reference,
              cancelledBy: admin.email,
              reason: dto.reason,
            },
            sendEmail: false,
          },
        );

        return this.transformFiatTransaction(updated);
      }
    }

    throw new NotFoundException(`Transaction with ID ${id} not found`);
  }

  /**
   * Get user details for a transaction
   */
  async getTransactionUser(
    id: number,
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ) {
    let userApiKey: string | undefined;
    let userEmail: string | undefined;

    if (type === 'transaction_history' || !type) {
      const transaction =
        await this.prisma.client.transaction_history.findUnique({
          where: { history_id: id },
          select: { user_api_key: true },
        });

      if (transaction) {
        userApiKey = transaction.user_api_key;
      }
    }

    if (!userApiKey && (type === 'wallet_transfer' || !type)) {
      const transaction = await this.prisma.client.wallet_transfers.findUnique({
        where: { transfer_id: id },
        select: { user_api_key: true },
      });

      if (transaction) {
        userApiKey = transaction.user_api_key;
      }
    }

    if (!userApiKey && (type === 'fiat_transfer' || !type)) {
      const transaction =
        await this.prisma.client.fiat_bank_transfers.findUnique({
          where: { id: id },
          select: { user_api_key: true, user_email: true },
        });

      if (transaction) {
        userApiKey = transaction.user_api_key;
        userEmail = transaction.user_email;
      }
    }

    if (!userApiKey) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Try to find user by API key first (if it's an API key)
    // Otherwise, try to find by email if user_api_key is actually an email
    // For fiat transfers, also check user_email field
    const user = await this.prisma.client.send_coin_user.findFirst({
      where: {
        OR: [
          { api_key: userApiKey },
          { user_email: userApiKey },
          ...(userEmail ? [{ user_email: userEmail }] : []),
        ],
      },
      select: {
        azer_id: true,
        first_name: true,
        last_name: true,
        user_email: true,
        verify_user: true,
        device: true,
        ip_addr: true,
        logincount: true,
        profession: true,
        offeredsolution: true,
        solutiontype: true,
        country: true,
        location: true,
        phone: true,
        device_security: true,
        activity_notify: true,
        default_currency: true,
        address: true,
        linkedin: true,
        facebook: true,
        twitter: true,
        instagram: true,
        github: true,
        profile_pix: true,
        webite: true,
        company_logo: true,
        company_name: true,
        company_verify: true,
        country_iso2: true,
        account_ban: true,
        timestamp: true,
        referal_id: true,
        referee: true,
        google_id: true,
        oauth_provider: true,
        apple_id: true,
        apple_verified: true,
        is_private_email: true,
        auth_provider: true,
        last_login_ip: true,
        last_login_location: true,
        last_login_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User not found for transaction ${id}`);
    }

    return user;
  }

  /**
   * Export transactions to CSV or JSON
   */
  async exportTransactions(
    dto: GetTransactionsDto,
    format: 'csv' | 'json' = 'csv',
  ): Promise<{ data: UnifiedTransactionResponseDto[]; csv?: string }> {
    // Override pagination to get all matching transactions (with a reasonable limit)
    const exportDto = { ...dto, page: 1, limit: 10000 };

    const result = await this.findAll(exportDto);
    const transactions = result.data;

    if (format === 'json') {
      return { data: transactions };
    }

    // Generate CSV
    const csvHeaders = [
      'ID',
      'Transaction ID',
      'Reference',
      'Type',
      'Category',
      'Status',
      'Currency (Crypto)',
      'Currency (Fiat)',
      'Amount (Crypto)',
      'Amount (Fiat)',
      'Amount Display',
      'Fee',
      'Source Address',
      'Source Type',
      'Destination Address',
      'Destination Type',
      'Network',
      'TX Hash',
      'Payment Method',
      'Status Updated By',
      'Status Notes',
      'Is Flagged',
      'Created At',
      'Updated At',
    ];

    const csvRows = transactions.map((tx) => [
      tx.id,
      tx.txId || '',
      tx.reference || '',
      tx.type || '',
      tx.transactionCategory || '',
      tx.status || '',
      tx.currency?.crypto || '',
      tx.currency?.fiat || '',
      tx.amount?.crypto?.toString() || '',
      tx.amount?.fiat?.toString() || '',
      tx.amount?.display || '',
      tx.fee?.toString() || '',
      tx.source?.address || '',
      tx.source?.type || '',
      tx.destination?.address || '',
      tx.destination?.type || '',
      tx.network || '',
      tx.txHash || '',
      tx.paymentMethod || '',
      tx.statusUpdatedBy || '',
      tx.statusNotes || '',
      tx.isFlagged ? 'Yes' : 'No',
      tx.createdAt?.toISOString() || '',
      tx.updatedAt?.toISOString() || '',
    ]);

    const escapeCsvField = (field: string | number | undefined): string => {
      const value = String(field ?? '');
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map(escapeCsvField).join(',')),
    ].join('\n');

    return { data: transactions, csv };
  }

  // Helper methods

  private buildDateFilter(
    dateFrom?: Date,
    dateTo?: Date,
  ): { created_at?: { gte?: bigint; lte?: bigint } } {
    if (!dateFrom && !dateTo) return {};

    const filter: { created_at?: { gte?: bigint; lte?: bigint } } = {};

    if (dateFrom) {
      filter.created_at = { gte: BigInt(dateFrom.getTime()) };
    }

    if (dateTo) {
      const toTimestamp = BigInt(dateTo.getTime());
      filter.created_at = {
        ...filter.created_at,
        lte: toTimestamp,
      };
    }

    return filter;
  }

  private buildHistoryFilters(dto: GetTransactionsDto): TransactionFilter {
    const filter: TransactionFilter = {};

    if (dto.status) {
      if ((dto.status as string) === '__pending_approvals__') {
        filter.status = { in: ['pending', 'pending_funding'] };
      } else {
        filter.status = dto.status;
      }
    }

    if (dto.flagged !== undefined) {
      filter.is_flagged = dto.flagged;
    }

    if (dto.currency) {
      filter.OR = [
        { crypto_sign: dto.currency },
        { currency_sign: dto.currency },
      ];
    }

    if (dto.asset) {
      filter.asset_type = dto.asset;
    }

    if (dto.search) {
      filter.OR = [
        { keychain: { contains: dto.search } },
        { reference: { contains: dto.search } },
        { user_api_key: { contains: dto.search } },
      ];
    }

    if (dto.dateFrom || dto.dateTo) {
      const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : undefined;
      const dateTo = dto.dateTo ? new Date(dto.dateTo) : undefined;
      Object.assign(filter, this.buildDateFilter(dateFrom, dateTo));
    }

    // Type filtering
    if (dto.type === TransactionType.BUY_SELL) {
      // Only transaction_history
    } else if (dto.type === TransactionType.WALLET_TRANSFER) {
      // This will be handled in transfer filters
      return { history_id: -1 }; // Return no results
    }

    return filter;
  }

  private buildTransferFilters(dto: GetTransactionsDto): TransactionFilter {
    const filter: TransactionFilter = {};

    if (dto.status) {
      if ((dto.status as string) === '__pending_approvals__') {
        filter.status = { in: ['pending', 'pending_funding'] };
      } else {
        filter.status = dto.status;
      }
    }

    if (dto.flagged !== undefined) {
      filter.is_flagged = dto.flagged;
    }

    if (dto.currency) {
      filter.asset = dto.currency;
    }

    if (dto.search) {
      filter.OR = [
        { reference: { contains: dto.search } },
        { user_api_key: { contains: dto.search } },
        { recipient_wallet_address: { contains: dto.search } },
      ];
    }

    if (dto.dateFrom || dto.dateTo) {
      const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : undefined;
      const dateTo = dto.dateTo ? new Date(dto.dateTo) : undefined;
      Object.assign(filter, this.buildDateFilter(dateFrom, dateTo));
    }

    // Type filtering
    if (dto.type === TransactionType.BUY_SELL) {
      return { transfer_id: -1 }; // Return no results
    }

    return filter;
  }

  private buildFiatFilters(dto: GetTransactionsDto): TransactionFilter {
    const filter: TransactionFilter = {};

    if (dto.status) {
      if ((dto.status as string) === '__pending_approvals__') {
        filter.status = { in: ['pending', 'pending_funding'] };
      } else {
        filter.status = dto.status;
      }
    }

    if (dto.flagged !== undefined) {
      filter.is_flagged = dto.flagged;
    }

    // Build OR conditions for currency and search
    const orConditions: Array<Record<string, unknown>> = [];

    if (dto.currency) {
      orConditions.push({ currency: dto.currency });
    }

    if (dto.search) {
      orConditions.push(
        { reference: { contains: dto.search } },
        { user_api_key: { contains: dto.search } },
        { user_email: { contains: dto.search } },
        { account_number: { contains: dto.search } },
      );
    }

    if (orConditions.length > 0) {
      filter.OR = orConditions;
    }

    if (dto.dateFrom || dto.dateTo) {
      const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : undefined;
      const dateTo = dto.dateTo ? new Date(dto.dateTo) : undefined;
      Object.assign(filter, this.buildDateFilter(dateFrom, dateTo));
    }

    // Type filtering
    if (
      dto.type === TransactionType.BUY_SELL ||
      dto.type === TransactionType.WALLET_TRANSFER
    ) {
      return { fiat_transfer_id: -1 }; // Return no results
    }

    return filter;
  }

  private buildOrderBy(
    dto: GetTransactionsDto,
    tableType: 'history' | 'transfer' | 'fiat',
  ): Record<string, 'asc' | 'desc'> {
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const sortOrder = dto.sortOrder || SortOrder.DESC;

    if (dto.sortBy === SortBy.CREATED_AT) {
      orderBy.created_at = sortOrder;
    } else if (dto.sortBy === SortBy.STATUS) {
      orderBy.status = sortOrder;
    } else if (dto.sortBy === SortBy.AMOUNT) {
      if (tableType === 'history') {
        orderBy.currency_amount = sortOrder;
      } else {
        orderBy.amount = sortOrder;
      }
    } else {
      orderBy.created_at = sortOrder;
    }

    return orderBy;
  }

  private transformFiatTransaction(
    transaction: FiatTransferRecord,
  ): UnifiedTransactionResponseDto {
    const txRecord = transaction as FiatTransferRecord & {
      created_at_timestamp?: Date;
      is_flagged?: boolean;
      flagged_at?: bigint;
      flagged_by?: string;
      flagged_reason?: string;
      status_updated_by?: string;
      status_updated_at?: bigint;
      status_notes?: string;
      onchain_tx_hash?: string;
    };

    const createdAt = txRecord.created_at_timestamp
      ? new Date(txRecord.created_at_timestamp)
      : new Date(Number(txRecord.created_at));

    const amountDisplay = `${Number(txRecord.amount)} ${txRecord.currency}`;

    return {
      id: txRecord.id,
      txId: txRecord.reference ?? undefined,
      reference: txRecord.reference ?? undefined,
      type: 'OUTGOING', // Fiat bank transfers are always outgoing
      transactionCategory: 'FIAT_TRANSFER',
      dateInitiated: createdAt,
      currency: {
        fiat: txRecord.currency ?? undefined,
        display: txRecord.currency || '',
      },
      amount: {
        fiat: Number(txRecord.amount),
        display: amountDisplay,
      },
      fee: undefined, // Not in fiat_bank_transfers schema
      status: txRecord.status || 'pending',
      isFlagged: txRecord.is_flagged || false,
      flaggedAt: txRecord.flagged_at
        ? new Date(Number(txRecord.flagged_at))
        : undefined,
      flaggedBy: txRecord.flagged_by,
      flaggedReason: txRecord.flagged_reason,
      source: {
        address: txRecord.user_api_key || 'N/A',
        type: 'BANK',
        name: txRecord.user_email,
      },
      destination: {
        address: txRecord.account_number ?? undefined,
        type: 'BANK',
        name: txRecord.full_name,
        network: txRecord.bank_name,
      },
      notes: txRecord.notes ?? undefined,
      statusUpdatedBy: txRecord.status_updated_by ?? undefined,
      statusUpdatedAt: txRecord.status_updated_at
        ? new Date(Number(txRecord.status_updated_at))
        : undefined,
      statusNotes: txRecord.status_notes ?? undefined,
      txHash: txRecord.onchain_tx_hash ?? undefined,
      createdAt,
      updatedAt: txRecord.updated_at
        ? new Date(Number(txRecord.updated_at))
        : undefined,
    };
  }

  private transformHistoryTransaction(
    transaction: TransactionHistoryRecord,
  ): UnifiedTransactionResponseDto {
    const txRecord = transaction as TransactionHistoryRecord & {
      created_at_timestamp?: Date;
      status_updated_by?: string;
      status_updated_at?: bigint;
      status_notes?: string;
      merchant_bank_account?: string;
      merchant_account_name?: string;
      merchant_bank_name?: string;
      payment_method?: string;
      payment_proof_url?: string;
      transaction_type?: string;
      is_flagged?: boolean;
      flagged_at?: bigint;
      flagged_by?: string;
      flagged_reason?: string;
      tx_hash?: string;
    };

    const createdAt = txRecord.created_at_timestamp
      ? new Date(txRecord.created_at_timestamp)
      : new Date(Number(txRecord.created_at));

    const amountDisplay = txRecord.currency_amount
      ? `N${Number(txRecord.currency_amount).toLocaleString()}`
      : txRecord.crypto_amount
        ? `${Number(txRecord.crypto_amount)} ${txRecord.crypto_sign?.toUpperCase() || ''}`
        : '0';

    return {
      id: txRecord.history_id,
      txId: txRecord.keychain ?? undefined,
      reference: txRecord.reference ?? undefined,
      type: this.determineTransactionType(txRecord, 'history'),
      transactionCategory: 'BUY_SELL',
      dateInitiated: createdAt,
      currency: {
        crypto: txRecord.crypto_sign ?? undefined,
        fiat: txRecord.currency_sign ?? undefined,
        display: txRecord.currency_sign || txRecord.crypto_sign || '',
      },
      amount: {
        crypto: txRecord.crypto_amount
          ? Number(txRecord.crypto_amount)
          : undefined,
        fiat: txRecord.currency_amount
          ? Number(txRecord.currency_amount)
          : undefined,
        display: amountDisplay,
      },
      fee: undefined, // Not in current schema
      status: txRecord.status || 'pending',
      isFlagged: txRecord.is_flagged || false,
      flaggedAt: txRecord.flagged_at
        ? new Date(Number(txRecord.flagged_at))
        : undefined,
      flaggedBy: txRecord.flagged_by,
      flaggedReason: txRecord.flagged_reason,
      source: {
        address: txRecord.merchant_bank_account || 'N/A',
        type: 'MERCHANT',
        name: txRecord.merchant_account_name,
      },
      destination: {
        address: txRecord.user_api_key || 'N/A',
        type: 'WALLET',
      },
      merchant: txRecord.merchants
        ? {
            keychain: txRecord.merchants.keychain ?? undefined,
            name: txRecord.merchants.user_name ?? undefined,
            email: txRecord.merchants.email ?? undefined,
            bankName: txRecord.merchant_bank_name,
            bankAccount: txRecord.merchant_bank_account,
          }
        : undefined,
      paymentMethod: txRecord.payment_method,
      paymentProofUrl: txRecord.payment_proof_url,
      statusUpdatedBy: txRecord.status_updated_by,
      statusUpdatedAt: txRecord.status_updated_at
        ? new Date(Number(txRecord.status_updated_at))
        : undefined,
      statusNotes: txRecord.status_notes,
      txHash: txRecord.tx_hash ?? undefined,
      createdAt,
      updatedAt: txRecord.updated_at
        ? new Date(Number(txRecord.updated_at))
        : undefined,
    };
  }

  private transformTransferTransaction(
    transaction: WalletTransferRecord,
  ): UnifiedTransactionResponseDto {
    const txRecord = transaction as WalletTransferRecord & {
      created_at_timestamp?: Date;
      tx_hash?: string;
      note?: string;
      recipient_name?: string;
      is_flagged?: boolean;
      flagged_at?: bigint;
      flagged_by?: string;
      flagged_reason?: string;
    };

    const createdAt = txRecord.created_at_timestamp
      ? new Date(txRecord.created_at_timestamp)
      : new Date(Number(txRecord.created_at));

    const amountDisplay = `${Number(txRecord.amount)} ${txRecord.asset}`;

    // Wallet transfers are outgoing from sender's perspective
    // Since we're viewing from admin perspective, treat as OUTGOING (money leaving platform)
    const transactionType = this.determineTransactionType(
      { transaction_type: 'transfer' },
      'transfer',
    );

    return {
      id: txRecord.transfer_id,
      txId: txRecord.reference ?? undefined,
      reference: txRecord.reference ?? undefined,
      type: transactionType,
      transactionCategory: 'WALLET_TRANSFER',
      dateInitiated: createdAt,
      currency: {
        crypto: txRecord.asset ?? undefined,
        display: txRecord.asset || '',
      },
      amount: {
        crypto: Number(txRecord.amount),
        display: amountDisplay,
      },
      fee: txRecord.fee ? Number(txRecord.fee) : undefined,
      status: txRecord.status || 'pending',
      isFlagged: txRecord.is_flagged || false,
      flaggedAt: txRecord.flagged_at
        ? new Date(Number(txRecord.flagged_at))
        : undefined,
      flaggedBy: txRecord.flagged_by,
      flaggedReason: txRecord.flagged_reason,
      source: {
        address: txRecord.user_api_key || 'N/A',
        type: 'WALLET',
      },
      destination: {
        address: txRecord.recipient_wallet_address ?? undefined,
        type: 'WALLET',
        name: txRecord.recipient_name,
        network: txRecord.network ?? undefined,
      },
      txHash: txRecord.tx_hash,
      network: txRecord.network ?? undefined,
      notes: txRecord.note,
      createdAt,
      updatedAt: txRecord.updated_at
        ? new Date(Number(txRecord.updated_at))
        : undefined,
    };
  }

  private determineTransactionType(
    transaction: { transaction_type?: string },
    tableType: 'history' | 'transfer',
  ): 'INCOMING' | 'OUTGOING' | 'CONVERSION' {
    if (tableType === 'history') {
      // Buy = user receiving crypto (incoming), Sell = user sending crypto (outgoing)
      if (transaction.transaction_type === 'buy') {
        return 'INCOMING';
      } else if (transaction.transaction_type === 'sell') {
        return 'OUTGOING';
      }
      return 'CONVERSION';
    } else {
      // For wallet transfers, need to check if user is sender or receiver
      // This would require checking user's wallet addresses
      return 'OUTGOING'; // Default for now
    }
  }
}
