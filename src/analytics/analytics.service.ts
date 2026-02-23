import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTransactionAnalytics(options: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const { startDate, endDate, groupBy = 'day' } = options;

    let dateFilter = '';
    const params: string[] = [];
    let paramIndex = 1;

    if (startDate) {
      dateFilter += ` AND timestamp >= $${paramIndex++}::timestamp`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND timestamp <= $${paramIndex++}::timestamp`;
      params.push(endDate);
    }

    let dateGrouping: string;
    let dateFormat: string;

    switch (groupBy) {
      case 'week':
        dateGrouping = "DATE_TRUNC('week', timestamp)";
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', timestamp)";
        dateFormat = 'YYYY-MM';
        break;
      case 'day':
      default:
        dateGrouping = 'DATE(timestamp)';
        dateFormat = 'YYYY-MM-DD';
        break;
    }

    // Volume and count by time period
    const volumeQuery = `
      SELECT
        TO_CHAR(${dateGrouping}, '${dateFormat}') as period,
        COUNT(*) as transaction_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COALESCE(SUM(CAST(fiat_amount AS DECIMAL)), 0) as total_volume,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN CAST(fiat_amount AS DECIMAL) END), 0) as completed_volume
      FROM transaction_history
      WHERE 1=1 ${dateFilter}
      GROUP BY ${dateGrouping}
      ORDER BY ${dateGrouping}
    `;

    // Pass parameters correctly - if params array is empty, don't spread it
    const volumeData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{
            period: string;
            transaction_count: bigint;
            completed_count: bigint;
            total_volume: string;
            completed_volume: string;
          }>
        >(volumeQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{
            period: string;
            transaction_count: bigint;
            completed_count: bigint;
            total_volume: string;
            completed_volume: string;
          }>
        >(volumeQuery);

    // Transaction by type
    const typeQuery = `
      SELECT
        transaction_type,
        COUNT(*) as count,
        COALESCE(SUM(CAST(fiat_amount AS DECIMAL)), 0) as volume
      FROM transaction_history
      WHERE 1=1 ${dateFilter}
      GROUP BY transaction_type
      ORDER BY count DESC
    `;

    const typeData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{ transaction_type: string | null; count: bigint; volume: string }>
        >(typeQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{ transaction_type: string | null; count: bigint; volume: string }>
        >(typeQuery);

    // Transaction by status
    const statusQuery = `
      SELECT
        status,
        COUNT(*) as count
      FROM transaction_history
      WHERE 1=1 ${dateFilter}
      GROUP BY status
      ORDER BY count DESC
    `;

    const statusData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{ status: string | null; count: bigint }>
        >(statusQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{ status: string | null; count: bigint }>
        >(statusQuery);

    // Transaction by currency
    const currencyQuery = `
      SELECT
        crypto_type,
        COUNT(*) as count,
        COALESCE(SUM(CAST(crypto_amount AS DECIMAL)), 0) as crypto_volume,
        COALESCE(SUM(CAST(fiat_amount AS DECIMAL)), 0) as fiat_volume
      FROM transaction_history
      WHERE 1=1 ${dateFilter}
      GROUP BY crypto_type
      ORDER BY count DESC
    `;

    const currencyData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{
            crypto_type: string | null;
            count: bigint;
            crypto_volume: string;
            fiat_volume: string;
          }>
        >(currencyQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{
            crypto_type: string | null;
            count: bigint;
            crypto_volume: string;
            fiat_volume: string;
          }>
        >(currencyQuery);

    return {
      timeSeries: volumeData.map((d) => ({
        period: d.period,
        transactionCount: Number(d.transaction_count),
        completedCount: Number(d.completed_count),
        totalVolume: d.total_volume,
        completedVolume: d.completed_volume,
      })),
      byType: typeData.map((d) => ({
        type: d.transaction_type || 'unknown',
        count: Number(d.count),
        volume: d.volume,
      })),
      byStatus: statusData.map((d) => ({
        status: d.status || 'unknown',
        count: Number(d.count),
      })),
      byCurrency: currencyData.map((d) => ({
        currency: d.crypto_type || 'unknown',
        count: Number(d.count),
        cryptoVolume: d.crypto_volume,
        fiatVolume: d.fiat_volume,
      })),
    };
  }

  async getUserAnalytics(options: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const { startDate, endDate, groupBy = 'day' } = options;

    let dateFilter = '';
    const params: string[] = [];
    let paramIndex = 1;

    if (startDate) {
      dateFilter += ` AND timestamp >= $${paramIndex++}::timestamp`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND timestamp <= $${paramIndex++}::timestamp`;
      params.push(endDate);
    }

    let dateGrouping: string;
    let dateFormat: string;

    switch (groupBy) {
      case 'week':
        dateGrouping = "DATE_TRUNC('week', timestamp)";
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', timestamp)";
        dateFormat = 'YYYY-MM';
        break;
      case 'day':
      default:
        dateGrouping = 'DATE(timestamp)';
        dateFormat = 'YYYY-MM-DD';
        break;
    }

    // New registrations over time
    const registrationQuery = `
      SELECT
        TO_CHAR(${dateGrouping}, '${dateFormat}') as period,
        COUNT(*) as count
      FROM send_coin_user
      WHERE 1=1 ${dateFilter}
      GROUP BY ${dateGrouping}
      ORDER BY ${dateGrouping}
    `;

    // Pass parameters correctly - if params array is empty, don't spread it
    const registrationData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{ period: string; count: bigint }>
        >(registrationQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{ period: string; count: bigint }>
        >(registrationQuery);

    // Users by country
    const countryQuery = `
      SELECT
        COALESCE(country, 'Unknown') as country,
        COUNT(*) as count
      FROM send_coin_user
      WHERE 1=1 ${dateFilter}
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `;

    const countryData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{ country: string; count: bigint }>
        >(countryQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{ country: string; count: bigint }>
        >(countryQuery);

    // Users by verification status
    const verificationQuery = `
      SELECT
        CASE
          WHEN verify_user = true THEN 'verified'
          ELSE 'unverified'
        END as status,
        COUNT(*) as count
      FROM send_coin_user
      WHERE 1=1 ${dateFilter}
      GROUP BY verify_user
    `;

    const verificationData = params.length > 0
      ? await this.prisma.client.$queryRawUnsafe<
          Array<{ status: string; count: bigint }>
        >(verificationQuery, ...params)
      : await this.prisma.client.$queryRawUnsafe<
          Array<{ status: string; count: bigint }>
        >(verificationQuery);

    return {
      registrations: registrationData.map((d) => ({
        period: d.period,
        count: Number(d.count),
      })),
      byCountry: countryData.map((d) => ({
        country: d.country,
        count: Number(d.count),
      })),
      byVerification: verificationData.map((d) => ({
        status: d.status,
        count: Number(d.count),
      })),
    };
  }

  async getRevenueAnalytics(options: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const { startDate, endDate, groupBy = 'day' } = options;

    let dateFilter = '';
    const params: string[] = [];
    let paramIndex = 1;

    if (startDate) {
      dateFilter += ` AND created_at >= $${paramIndex++}::timestamp`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND created_at <= $${paramIndex++}::timestamp`;
      params.push(endDate);
    }

    let dateGrouping: string;
    let dateFormat: string;

    switch (groupBy) {
      case 'week':
        dateGrouping = "DATE_TRUNC('week', created_at)";
        dateFormat = 'YYYY-WW';
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', created_at)";
        dateFormat = 'YYYY-MM';
        break;
      case 'day':
      default:
        dateGrouping = 'DATE(created_at)';
        dateFormat = 'YYYY-MM-DD';
        break;
    }

    try {
      // Revenue over time from platform_ledger
      const revenueQuery = `
        SELECT
          TO_CHAR(${dateGrouping}, '${dateFormat}') as period,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount END), 0) as revenue,
          COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount END), 0) as expenses
        FROM platform_ledger
        WHERE 1=1 ${dateFilter}
        GROUP BY ${dateGrouping}
        ORDER BY ${dateGrouping}
      `;

      // Pass parameters correctly - if params array is empty, don't spread it
      const revenueData = params.length > 0
        ? await this.prisma.client.$queryRawUnsafe<
            Array<{ period: string; revenue: string; expenses: string }>
          >(revenueQuery, ...params)
        : await this.prisma.client.$queryRawUnsafe<
            Array<{ period: string; revenue: string; expenses: string }>
          >(revenueQuery);

      // Revenue by category
      const categoryQuery = `
        SELECT
          COALESCE(category, 'other') as category,
          COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount END), 0) as amount
        FROM platform_ledger
        WHERE entry_type = 'credit' ${dateFilter}
        GROUP BY category
        ORDER BY amount DESC
      `;

      const categoryData = params.length > 0
        ? await this.prisma.client.$queryRawUnsafe<
            Array<{ category: string; amount: string }>
          >(categoryQuery, ...params)
        : await this.prisma.client.$queryRawUnsafe<
            Array<{ category: string; amount: string }>
          >(categoryQuery);

      return {
        timeSeries: revenueData.map((d) => ({
          period: d.period,
          revenue: d.revenue,
          expenses: d.expenses,
        })),
        byCategory: categoryData.map((d) => ({
          category: d.category,
          amount: d.amount,
        })),
      };
    } catch {
      // Platform ledger table might not exist
      return {
        timeSeries: [],
        byCategory: [],
        message:
          'Revenue analytics not available - platform_ledger table not found',
      };
    }
  }

  async getTopUsers(options: {
    limit?: number;
    metric?: 'transactions' | 'volume';
  }) {
    const { limit = 10, metric = 'transactions' } = options;

    let orderBy: string;
    if (metric === 'volume') {
      orderBy = 'total_volume DESC';
    } else {
      orderBy = 'transaction_count DESC';
    }

    const query = `
      SELECT
        u.azer_id,
        u.user_email,
        u.first_name,
        u.last_name,
        u.country,
        COUNT(t.transaction_id) as transaction_count,
        COALESCE(SUM(CAST(t.fiat_amount AS DECIMAL)), 0) as total_volume
      FROM send_coin_user u
      LEFT JOIN transaction_history t ON u.api_key = t.user_api_key
      GROUP BY u.azer_id, u.user_email, u.first_name, u.last_name, u.country
      HAVING COUNT(t.transaction_id) > 0
      ORDER BY ${orderBy}
      LIMIT $1
    `;

    const data = await this.prisma.client.$queryRawUnsafe<
      Array<{
        azer_id: number;
        user_email: string | null;
        first_name: string | null;
        last_name: string | null;
        country: string | null;
        transaction_count: bigint;
        total_volume: string;
      }>
    >(query, limit);

    return data.map((d) => ({
      userId: d.azer_id,
      email: d.user_email,
      name: `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'N/A',
      country: d.country,
      transactionCount: Number(d.transaction_count),
      totalVolume: d.total_volume,
    }));
  }
}
