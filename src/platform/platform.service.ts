import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get platform account balance
   */
  async getBalance(currency = 'NGN') {
    // Try to get from platform_balance_summary view first
    try {
      const result = await this.prisma.client.$queryRaw<
        Array<{
          account_type: string;
          account_name: string;
          currency: string;
          current_balance: number;
          total_fees_collected: number;
          total_paid_out: number;
          net_profit: number;
          status: string;
          total_transactions: number;
          pending_amount: number;
          last_updated: Date;
        }>
      >`
        SELECT * FROM platform_balance_summary
        WHERE currency = ${currency}
        ORDER BY last_updated DESC
        LIMIT 1
      `;

      if (result.length > 0) {
        const account = result[0];
        return {
          accountType: account.account_type,
          accountName: account.account_name,
          currency: account.currency,
          currentBalance: String(account.current_balance || 0),
          totalFeesCollected: String(account.total_fees_collected || 0),
          totalPaidOut: String(account.total_paid_out || 0),
          netProfit: String(account.net_profit || 0),
          status: account.status,
          totalTransactions: account.total_transactions || 0,
          pendingAmount: String(account.pending_amount || 0),
          lastUpdated: account.last_updated,
        };
      }
    } catch {
      // View might not exist, try direct table query
    }

    // Fallback to platform_accounts table
    try {
      const result = await this.prisma.client.$queryRaw<
        Array<{
          id: string;
          account_type: string;
          account_name: string;
          currency: string;
          current_balance: number;
          total_fees_collected: number;
          total_paid_out: number;
          status: string;
          last_updated: Date;
        }>
      >`
        SELECT * FROM platform_accounts
        WHERE currency = ${currency} AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length > 0) {
        const account = result[0];
        return {
          accountType: account.account_type,
          accountName: account.account_name,
          currency: account.currency,
          currentBalance: String(account.current_balance || 0),
          totalFeesCollected: String(account.total_fees_collected || 0),
          totalPaidOut: String(account.total_paid_out || 0),
          netProfit: String(
            (account.total_fees_collected || 0) - (account.total_paid_out || 0),
          ),
          status: account.status,
          totalTransactions: 0,
          pendingAmount: '0',
          lastUpdated: account.last_updated,
        };
      }
    } catch {
      // Table might not exist
    }

    return null;
  }

  /**
   * Get revenue report
   */
  async getRevenueReport(params: {
    startDate?: string;
    endDate?: string;
    currency?: string;
  }) {
    const { startDate, endDate, currency } = params;

    try {
      // Build dynamic query
      let query = `
        SELECT
          transaction_type,
          currency,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(usd_equivalent), 0) as total_usd,
          COALESCE(AVG(amount), 0) as avg_amount
        FROM platform_ledger
        WHERE status IN ('collected', 'settled')
      `;

      const conditions: string[] = [];

      if (startDate) {
        conditions.push(`created_at >= '${startDate}'`);
      }
      if (endDate) {
        conditions.push(`created_at <= '${endDate} 23:59:59'`);
      }
      if (currency) {
        conditions.push(`currency = '${currency}'`);
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query +=
        ' GROUP BY transaction_type, currency ORDER BY total_amount DESC';

      const result = await this.prisma.client.$queryRawUnsafe<
        Array<{
          transaction_type: string;
          currency: string;
          count: bigint;
          total_amount: number;
          total_usd: number;
          avg_amount: number;
        }>
      >(query);

      const breakdown = result.map((row) => ({
        category: row.transaction_type,
        currency: row.currency,
        count: Number(row.count),
        amount: String(row.total_amount || 0),
        amountUsd: String(row.total_usd || 0),
        avgAmount: String(row.avg_amount || 0),
        percentage: 0, // Will calculate below
      }));

      // Calculate percentages
      const totalAmount = breakdown.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0,
      );
      breakdown.forEach((item) => {
        item.percentage =
          totalAmount > 0
            ? Math.round((parseFloat(item.amount) / totalAmount) * 100)
            : 0;
      });

      const totalRevenueUsd = breakdown.reduce(
        (sum, item) => sum + parseFloat(item.amountUsd),
        0,
      );

      // Build daily breakdown query
      let dailyQuery = `
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(usd_equivalent), 0) as total_usd,
          COUNT(*) as count
        FROM platform_ledger
        WHERE status IN ('collected', 'settled')
      `;

      if (conditions.length > 0) {
        dailyQuery += ' AND ' + conditions.join(' AND ');
      }

      dailyQuery += ' GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30';

      const dailyResult = await this.prisma.client.$queryRawUnsafe<
        Array<{
          date: Date;
          total_amount: number;
          total_usd: number;
          count: bigint;
        }>
      >(dailyQuery);

      const daily = dailyResult.map((row) => ({
        date: row.date.toISOString().split('T')[0],
        amount: String(row.total_amount || 0),
        amountUsd: String(row.total_usd || 0),
        count: Number(row.count),
      }));

      return {
        period: startDate || 'month',
        totalRevenue: String(totalAmount),
        totalRevenueUsd: String(totalRevenueUsd),
        breakdown,
        daily,
      };
    } catch {
      // Table might not exist
      return {
        period: params.startDate || 'month',
        totalRevenue: '0',
        totalRevenueUsd: '0',
        breakdown: [],
        daily: [],
      };
    }
  }

  /**
   * Get platform account details
   */
  async getPlatformAccount() {
    try {
      const result = await this.prisma.client.$queryRaw<
        Array<{
          id: string;
          account_type: string;
          account_name: string;
          currency: string;
          current_balance: number;
          total_fees_collected: number;
          crayfi_account_number: string;
          crayfi_account_id: string;
          crayfi_bank_name: string;
          crayfi_bank_code: string;
          status: string;
          created_at: Date;
          last_updated: Date;
        }>
      >`
        SELECT * FROM platform_accounts
        WHERE account_type = 'crayfi_ngn' AND currency = 'NGN'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const account = result[0];
      return {
        accountId: account.id,
        accountType: account.account_type,
        accountName: account.account_name,
        currency: account.currency,
        currentBalance: String(account.current_balance || 0),
        totalFeesCollected: String(account.total_fees_collected || 0),
        crayfiAccountNumber: account.crayfi_account_number,
        crayfiAccountId: account.crayfi_account_id,
        crayfiBankName: account.crayfi_bank_name,
        crayfiBankCode: account.crayfi_bank_code,
        status: account.status,
        createdAt: account.created_at,
        lastUpdated: account.last_updated,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all platform wallets (fee wallet, hot wallet)
   */
  async getPlatformWallets() {
    const feeWallet = await this.getBalance('NGN');

    // For now, return the fee wallet as both fee and hot wallet
    // In a real implementation, you'd have separate wallets
    return {
      feeWallet: feeWallet
        ? {
            address: feeWallet.accountName || 'Platform Fee Wallet',
            balances: [
              {
                currency: feeWallet.currency,
                amount: feeWallet.currentBalance,
                amountUsd: feeWallet.currentBalance, // Assuming NGN for now
              },
            ],
            totalUsd: feeWallet.totalFeesCollected,
          }
        : {
            address: 'Not configured',
            balances: [],
            totalUsd: '0',
          },
      hotWallet: {
        address: 'Hot Wallet',
        balances: [],
        totalUsd: '0',
      },
    };
  }

  /**
   * Get combined platform stats
   */
  async getPlatformStats() {
    const balance = await this.getBalance('NGN');
    const revenue = await this.getRevenueReport({});

    return {
      totalFeesCollected: balance?.totalFeesCollected || '0',
      currentBalance: balance?.currentBalance || '0',
      totalRevenue: revenue.totalRevenue,
      totalRevenueUsd: revenue.totalRevenueUsd,
      revenueBreakdown: revenue.breakdown,
    };
  }
}
