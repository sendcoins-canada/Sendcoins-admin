import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    // Run all queries in parallel for better performance
    const [
      userStats,
      transactionStats,
      platformStats,
      kycStats,
      recentActivity,
    ] = await Promise.all([
      this.getUserStats(),
      this.getTransactionStats(),
      this.getPlatformStats(),
      this.getKycStats(),
      this.getRecentActivity(),
    ]);

    return {
      users: userStats,
      transactions: transactionStats,
      platform: platformStats,
      kyc: kycStats,
      recentActivity,
    };
  }

  async getUserStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN account_ban = 'false' OR account_ban IS NULL THEN 1 END) as active,
        COUNT(CASE WHEN account_ban = 'true' THEN 1 END) as suspended,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week
      FROM send_coin_user
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        total: bigint;
        active: bigint;
        suspended: bigint;
        new_this_month: bigint;
        new_this_week: bigint;
      }>
    >(query);

    return {
      total: Number(result[0]?.total || 0),
      active: Number(result[0]?.active || 0),
      suspended: Number(result[0]?.suspended || 0),
      newThisMonth: Number(result[0]?.new_this_month || 0),
      newThisWeek: Number(result[0]?.new_this_week || 0),
    };
  }

  async getTransactionStats() {
    // Get transaction stats from transaction_history table
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN is_flagged = true THEN 1 END) as flagged,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(crypto_amount AS DECIMAL) END), 0) as total_crypto_volume,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(fiat_amount AS DECIMAL) END), 0) as total_fiat_volume,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '30 days' THEN 1 END) as this_month,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '1 day' THEN 1 END) as today
      FROM transaction_history
    `;

    const result = await this.prisma.client.$queryRawUnsafe<
      Array<{
        total: bigint;
        completed: bigint;
        pending: bigint;
        failed: bigint;
        flagged: bigint;
        total_crypto_volume: string | null;
        total_fiat_volume: string | null;
        this_month: bigint;
        this_week: bigint;
        today: bigint;
      }>
    >(query);

    return {
      total: Number(result[0]?.total || 0),
      completed: Number(result[0]?.completed || 0),
      pending: Number(result[0]?.pending || 0),
      failed: Number(result[0]?.failed || 0),
      flagged: Number(result[0]?.flagged || 0),
      totalCryptoVolume: result[0]?.total_crypto_volume || '0',
      totalFiatVolume: result[0]?.total_fiat_volume || '0',
      thisMonth: Number(result[0]?.this_month || 0),
      thisWeek: Number(result[0]?.this_week || 0),
      today: Number(result[0]?.today || 0),
    };
  }

  async getPlatformStats() {
    // Get platform wallet balances and revenue
    const platformQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN account_type = 'fee_wallet' THEN balance END), 0) as fee_wallet_balance,
        COALESCE(SUM(CASE WHEN account_type = 'hot_wallet' THEN balance END), 0) as hot_wallet_balance
      FROM platform_accounts
    `;

    let feeWalletBalance = '0';
    let hotWalletBalance = '0';

    try {
      const platformResult = await this.prisma.client.$queryRawUnsafe<
        Array<{
          fee_wallet_balance: string | null;
          hot_wallet_balance: string | null;
        }>
      >(platformQuery);
      feeWalletBalance = platformResult[0]?.fee_wallet_balance || '0';
      hotWalletBalance = platformResult[0]?.hot_wallet_balance || '0';
    } catch {
      // Platform accounts table might not exist
    }

    // Get monthly revenue from platform_ledger
    let monthlyRevenue = '0';
    try {
      const revenueQuery = `
        SELECT COALESCE(SUM(amount), 0) as monthly_revenue
        FROM platform_ledger
        WHERE entry_type = 'credit'
        AND created_at >= DATE_TRUNC('month', NOW())
      `;
      const revenueResult =
        await this.prisma.client.$queryRawUnsafe<
          Array<{ monthly_revenue: string | null }>
        >(revenueQuery);
      monthlyRevenue = revenueResult[0]?.monthly_revenue || '0';
    } catch {
      // Platform ledger table might not exist
    }

    return {
      feeWalletBalance,
      hotWalletBalance,
      monthlyRevenue,
    };
  }

  async getKycStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN verify_user = true THEN 1 END) as verified,
        COUNT(CASE WHEN verify_user IS NULL OR verify_user = false THEN 1 END) as pending
      FROM send_coin_user
    `;

    const result =
      await this.prisma.client.$queryRawUnsafe<
        Array<{ total: bigint; verified: bigint; pending: bigint }>
      >(query);

    const total = Number(result[0]?.total || 0);
    const verified = Number(result[0]?.verified || 0);

    return {
      total,
      verified,
      pending: Number(result[0]?.pending || 0),
      verificationRate: total > 0 ? ((verified / total) * 100).toFixed(1) : '0',
    };
  }

  async getRecentActivity() {
    // Get recent admin audit logs
    const logs = await this.prisma.client.adminAuditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch admin info for logs that have adminId
    const adminIds = logs
      .map((log) => log.adminId)
      .filter((id): id is number => id !== null);
    const admins =
      adminIds.length > 0
        ? await this.prisma.client.adminUser.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    return logs.map((log) => {
      const admin = log.adminId ? adminMap.get(log.adminId) : null;
      return {
        id: log.id,
        action: log.action,
        adminName: admin
          ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() ||
            admin.email
          : 'System',
        timestamp: log.createdAt,
        details: log.detail,
      };
    });
  }

  async getChartData(period: 'week' | 'month' | 'year' = 'month') {
    let interval: string;
    let groupBy: string;
    let dateFormat: string;

    switch (period) {
      case 'week':
        interval = '7 days';
        groupBy = 'DATE(timestamp)';
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'year':
        interval = '365 days';
        groupBy = "DATE_TRUNC('month', timestamp)";
        dateFormat = 'YYYY-MM';
        break;
      case 'month':
      default:
        interval = '30 days';
        groupBy = 'DATE(timestamp)';
        dateFormat = 'YYYY-MM-DD';
        break;
    }

    // Transaction volume over time
    const transactionQuery = `
      SELECT
        TO_CHAR(${groupBy}, '${dateFormat}') as date,
        COUNT(*) as count,
        COALESCE(SUM(CAST(fiat_amount AS DECIMAL)), 0) as volume
      FROM transaction_history
      WHERE timestamp >= NOW() - INTERVAL '${interval}'
      GROUP BY ${groupBy}
      ORDER BY ${groupBy}
    `;

    const transactionData =
      await this.prisma.client.$queryRawUnsafe<
        Array<{ date: string; count: bigint; volume: string }>
      >(transactionQuery);

    // New user registrations over time
    const userQuery = `
      SELECT
        TO_CHAR(${groupBy.replace('timestamp', 'timestamp')}, '${dateFormat}') as date,
        COUNT(*) as count
      FROM send_coin_user
      WHERE timestamp >= NOW() - INTERVAL '${interval}'
      GROUP BY ${groupBy.replace('timestamp', 'timestamp')}
      ORDER BY ${groupBy.replace('timestamp', 'timestamp')}
    `;

    const userData =
      await this.prisma.client.$queryRawUnsafe<
        Array<{ date: string; count: bigint }>
      >(userQuery);

    return {
      transactions: transactionData.map((d) => ({
        date: d.date,
        count: Number(d.count),
        volume: d.volume,
      })),
      users: userData.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
    };
  }

  async getPendingItems() {
    // Get counts of items requiring admin attention
    const [pendingTransactions, pendingKyc, flaggedTransactions] =
      await Promise.all([
        this.prisma.client.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*) as count FROM transaction_history WHERE status = 'pending'`,
        ),
        this.prisma.client.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*) as count FROM send_coin_user WHERE verify_user IS NULL OR verify_user = false`,
        ),
        this.prisma.client.$queryRawUnsafe<[{ count: bigint }]>(
          `SELECT COUNT(*) as count FROM transaction_history WHERE is_flagged = true`,
        ),
      ]);

    return {
      pendingTransactions: Number(pendingTransactions[0]?.count || 0),
      pendingKyc: Number(pendingKyc[0]?.count || 0),
      flaggedTransactions: Number(flaggedTransactions[0]?.count || 0),
    };
  }
}
