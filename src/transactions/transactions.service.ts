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
import {
  UnifiedTransactionResponseDto,
  TransactionStatsResponseDto,
  PaginatedTransactionsResponseDto,
} from './dto/transaction-response.dto';
import { Prisma } from '@prisma/client';

// Types for transaction records
type TransactionHistoryRecord = Prisma.transaction_historyGetPayload<{
  include: { merchants: true };
}>;

type WalletTransferRecord = Prisma.wallet_transfersGetPayload<object>;

// Filter types for better type safety
interface TransactionFilter {
  status?: string;
  created_at?: { gte?: bigint; lte?: bigint };
  OR?: Array<Record<string, unknown>>;
  asset_type?: string;
  asset?: string;
  history_id?: number;
  transfer_id?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.client.wallet_transfers.aggregate({
        where: transferWhere,
        _sum: {
          amount: true,
          fee: true,
        },
      }),
    ]);

    // Count by type (simplified - would need more complex logic for incoming/outgoing)
    const incoming = 0; // TODO: Calculate based on user perspective
    const outgoing = historyCompleted + transferCompleted;
    const conversion = historyCompleted;

    return {
      totalVolume: {
        crypto:
          Number(historyTotalVolume._sum.crypto_amount || 0) +
          Number(transferTotalVolume._sum.amount || 0),
        fiat: Number(historyTotalVolume._sum.currency_amount || 0),
      },
      completed: historyCompleted + transferCompleted,
      pending: historyPending + transferPending,
      failed: historyFailed + transferFailed,
      flagged: 0, // TODO: Add when is_flagged field is added
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

    // Check if we should fetch from both tables or just one
    const fetchHistory = dto.type !== TransactionType.WALLET_TRANSFER;
    const fetchTransfers = dto.type !== TransactionType.BUY_SELL;

    // Get counts
    const [historyCount, transferCount] = await Promise.all([
      fetchHistory
        ? this.prisma.client.transaction_history.count({
            where: historyFilters,
          })
        : Promise.resolve(0),
      fetchTransfers
        ? this.prisma.client.wallet_transfers.count({ where: transferFilters })
        : Promise.resolve(0),
    ]);

    const total = historyCount + transferCount;
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

    const [historyTransactions, transferTransactions] = await Promise.all([
      fetchHistory && historyCount > 0
        ? this.prisma.client.transaction_history.findMany({
            where: historyFilters,
            take: fetchTransfers ? fetchLimit : limit + skip,
            orderBy: this.buildOrderBy(dto, 'history'),
            include: {
              merchants: true,
            },
          })
        : Promise.resolve([]),
      fetchTransfers && transferCount > 0
        ? this.prisma.client.wallet_transfers.findMany({
            where: transferFilters,
            take: fetchHistory ? fetchLimit : limit + skip,
            orderBy: this.buildOrderBy(dto, 'transfer'),
          })
        : Promise.resolve([]),
    ]);

    // Transform and combine
    const unifiedTransactions = [
      ...historyTransactions.map((t) => this.transformHistoryTransaction(t)),
      ...transferTransactions.map((t) => this.transformTransferTransaction(t)),
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
   * Get single transaction by ID
   */
  async findOne(
    id: number,
    type?: 'transaction_history' | 'wallet_transfer',
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

    // Note: This will work once is_flagged fields are added to schema
    // For now, we'll throw an error indicating schema update needed
    throw new BadRequestException(
      'Flagging functionality requires schema update. Please add is_flagged fields to transaction tables.',
    );
  }

  /**
   * Unflag a transaction
   * @param _id - Transaction ID (unused, requires schema update)
   * @param _type - Transaction type (unused, requires schema update)
   */
  unflagTransaction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _id: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _type?: 'transaction_history' | 'wallet_transfer',
  ): Promise<UnifiedTransactionResponseDto> {
    // Similar to flagTransaction - requires schema update
    throw new BadRequestException(
      'Unflagging functionality requires schema update. Please add is_flagged fields to transaction tables.',
    );
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
        } else {
          await this.prisma.client.wallet_transfers.update({
            where: { transfer_id: id },
            data: {
              status: dto.status,
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
   * @param _dto - Bulk flag DTO (unused, requires schema update)
   * @param _adminId - Admin ID (unused, requires schema update)
   */
  bulkFlag(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dto: BulkFlagDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adminId: number,
  ): Promise<{
    flagged: number;
    failed: Array<{ id: number; error: string }>;
  }> {
    // Requires schema update
    throw new BadRequestException(
      'Bulk flagging functionality requires schema update. Please add is_flagged fields to transaction tables.',
    );
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
      filter.status = dto.status;
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
      filter.status = dto.status;
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

  private buildOrderBy(
    dto: GetTransactionsDto,
    tableType: 'history' | 'transfer',
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
      isFlagged: false, // Not in current schema
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
    };

    const createdAt = txRecord.created_at_timestamp
      ? new Date(txRecord.created_at_timestamp)
      : new Date(Number(txRecord.created_at));

    const amountDisplay = `${Number(txRecord.amount)} ${txRecord.asset}`;

    return {
      id: txRecord.transfer_id,
      txId: txRecord.reference ?? undefined,
      reference: txRecord.reference ?? undefined,
      type: 'OUTGOING', // TODO: Determine based on user perspective
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
      isFlagged: false, // Not in current schema
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
