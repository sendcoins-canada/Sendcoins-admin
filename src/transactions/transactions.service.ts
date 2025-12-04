import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetTransactionsDto, TransactionType, TransactionStatus } from './dto/get-transactions.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { FlagTransactionDto } from './dto/flag-transaction.dto';
import { BulkUpdateStatusDto, BulkFlagDto } from './dto/bulk-action.dto';
import {
  UnifiedTransactionResponseDto,
  TransactionStatsResponseDto,
  PaginatedTransactionsResponseDto,
} from './dto/transaction-response.dto';

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
        ? this.prisma.client.transaction_history.count({ where: historyFilters })
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
      limit + skip + (limit * 0.5), // Fetch extra to account for sorting
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
      if (dto.sortBy === 'amount') {
        const aAmount = a.amount.crypto || a.amount.fiat || 0;
        const bAmount = b.amount.crypto || b.amount.fiat || 0;
        return dto.sortOrder === 'asc'
          ? aAmount - bAmount
          : bAmount - aAmount;
      }

      if (dto.sortBy === 'status') {
        const statusOrder = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
        const aIndex = statusOrder.indexOf(a.status) || 0;
        const bIndex = statusOrder.indexOf(b.status) || 0;
        return dto.sortOrder === 'asc'
          ? aIndex - bIndex
          : bIndex - aIndex;
      }

      // Default: sort by created_at
      if (dto.sortOrder === 'asc') {
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
      const transaction = await this.prisma.client.transaction_history.findUnique({
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
      const transaction = await this.prisma.client.transaction_history.findUnique({
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
   */
  async unflagTransaction(
    id: number,
    type?: 'transaction_history' | 'wallet_transfer',
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
  ): Promise<{ updated: number; failed: Array<{ id: number; error: string }> }> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    const results = { updated: 0, failed: [] as Array<{ id: number; error: string }> };

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
      } catch (error: any) {
        results.failed.push({ id, error: error.message });
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
  ): Promise<{ flagged: number; failed: Array<{ id: number; error: string }> }> {
    // Requires schema update
    throw new BadRequestException(
      'Bulk flagging functionality requires schema update. Please add is_flagged fields to transaction tables.',
    );
  }

  // Helper methods

  private buildDateFilter(dateFrom?: Date, dateTo?: Date) {
    if (!dateFrom && !dateTo) return {};

    const filter: any = {};

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

  private buildHistoryFilters(dto: GetTransactionsDto) {
    const filter: any = {};

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

  private buildTransferFilters(dto: GetTransactionsDto) {
    const filter: any = {};

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
  ) {
    const orderBy: any = {};

    if (dto.sortBy === 'created_at') {
      orderBy.created_at = dto.sortOrder || 'desc';
    } else if (dto.sortBy === 'status') {
      orderBy.status = dto.sortOrder || 'desc';
    } else if (dto.sortBy === 'amount') {
      if (tableType === 'history') {
        orderBy.currency_amount = dto.sortOrder || 'desc';
      } else {
        orderBy.amount = dto.sortOrder || 'desc';
      }
    } else {
      orderBy.created_at = dto.sortOrder || 'desc';
    }

    return orderBy;
  }

  private transformHistoryTransaction(transaction: any): UnifiedTransactionResponseDto {
    const createdAt = transaction.created_at_timestamp
      ? new Date(transaction.created_at_timestamp)
      : new Date(Number(transaction.created_at));

    const amountDisplay = transaction.currency_amount
      ? `N${Number(transaction.currency_amount).toLocaleString()}`
      : transaction.crypto_amount
        ? `${Number(transaction.crypto_amount)} ${transaction.crypto_sign?.toUpperCase() || ''}`
        : '0';

    return {
      id: transaction.history_id,
      txId: transaction.keychain,
      reference: transaction.reference,
      type: this.determineTransactionType(transaction, 'history'),
      transactionCategory: 'BUY_SELL',
      dateInitiated: createdAt,
      currency: {
        crypto: transaction.crypto_sign,
        fiat: transaction.currency_sign,
        display: transaction.currency_sign || transaction.crypto_sign || '',
      },
      amount: {
        crypto: transaction.crypto_amount
          ? Number(transaction.crypto_amount)
          : undefined,
        fiat: transaction.currency_amount
          ? Number(transaction.currency_amount)
          : undefined,
        display: amountDisplay,
      },
      fee: undefined, // Not in current schema
      status: transaction.status || 'pending',
      isFlagged: false, // Not in current schema
      source: {
        address: transaction.merchant_bank_account || 'N/A',
        type: 'MERCHANT',
        name: transaction.merchant_account_name,
      },
      destination: {
        address: transaction.user_api_key || 'N/A',
        type: 'WALLET',
      },
      merchant: transaction.merchants
        ? {
            keychain: transaction.merchants.keychain,
            name: transaction.merchants.user_name,
            email: transaction.merchants.email,
            bankName: transaction.merchant_bank_name,
            bankAccount: transaction.merchant_bank_account,
          }
        : undefined,
      paymentMethod: transaction.payment_method,
      paymentProofUrl: transaction.payment_proof_url,
      statusUpdatedBy: transaction.status_updated_by,
      statusUpdatedAt: transaction.status_updated_at
        ? new Date(Number(transaction.status_updated_at))
        : undefined,
      statusNotes: transaction.status_notes,
      createdAt,
      updatedAt: transaction.updated_at
        ? new Date(Number(transaction.updated_at))
        : undefined,
    };
  }

  private transformTransferTransaction(transaction: any): UnifiedTransactionResponseDto {
    const createdAt = transaction.created_at_timestamp
      ? new Date(transaction.created_at_timestamp)
      : new Date(Number(transaction.created_at));

    const amountDisplay = `${Number(transaction.amount)} ${transaction.asset}`;

    return {
      id: transaction.transfer_id,
      txId: transaction.reference,
      reference: transaction.reference,
      type: 'OUTGOING', // TODO: Determine based on user perspective
      transactionCategory: 'WALLET_TRANSFER',
      dateInitiated: createdAt,
      currency: {
        crypto: transaction.asset,
        display: transaction.asset,
      },
      amount: {
        crypto: Number(transaction.amount),
        display: amountDisplay,
      },
      fee: transaction.fee ? Number(transaction.fee) : undefined,
      status: transaction.status || 'pending',
      isFlagged: false, // Not in current schema
      source: {
        address: transaction.user_api_key || 'N/A',
        type: 'WALLET',
      },
      destination: {
        address: transaction.recipient_wallet_address,
        type: 'WALLET',
        name: transaction.recipient_name,
        network: transaction.network,
      },
      txHash: transaction.tx_hash,
      network: transaction.network,
      notes: transaction.note,
      createdAt,
      updatedAt: transaction.updated_at
        ? new Date(Number(transaction.updated_at))
        : undefined,
    };
  }

  private determineTransactionType(
    transaction: any,
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

