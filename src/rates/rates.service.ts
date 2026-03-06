import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CurrencyRate {
  currency_name: string;
  currency_init: string;
  country: string | null;
  image: string | null;
  currency_sign: string | null;
  selling_rate: number | null;
  buying_rate: number | null;
  market_rate: number | null;
  flag: string | null;
  flag_emoji: string | null;
}

export class UpdateRateDto {
  buying_rate?: number;
  selling_rate?: number;
  market_rate?: number;
}

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all currency rates
   */
  async getAllRates(): Promise<CurrencyRate[]> {
    const rows = await this.prisma.client.$queryRaw<CurrencyRate[]>`
      SELECT currency_name, currency_init, country, image, currency_sign,
             selling_rate, buying_rate, market_rate, flag, flag_emoji
      FROM currency
      ORDER BY currency_name ASC
    `;
    return rows;
  }

  /**
   * Get a single currency rate by currency_init (e.g., 'NGN', 'USD')
   */
  async getRateByInit(currencyInit: string): Promise<CurrencyRate> {
    const rows = await this.prisma.client.$queryRaw<CurrencyRate[]>`
      SELECT currency_name, currency_init, country, image, currency_sign,
             selling_rate, buying_rate, market_rate, flag, flag_emoji
      FROM currency
      WHERE UPPER(currency_init) = UPPER(${currencyInit})
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`Currency '${currencyInit}' not found`);
    }

    return rows[0];
  }

  /**
   * Update currency rates
   */
  async updateRate(
    currencyInit: string,
    data: UpdateRateDto,
    adminId: number,
  ): Promise<{ data: CurrencyRate; beforeData: UpdateRateDto; afterData: UpdateRateDto }> {
    // Get current rate for before/after comparison
    const current = await this.getRateByInit(currencyInit);

    const beforeData: UpdateRateDto = {
      buying_rate: current.buying_rate ?? undefined,
      selling_rate: current.selling_rate ?? undefined,
      market_rate: current.market_rate ?? undefined,
    };

    // Build dynamic update
    const updates: string[] = [];
    const values: (number | null)[] = [];

    if (data.buying_rate !== undefined) {
      updates.push('buying_rate');
      values.push(data.buying_rate);
    }
    if (data.selling_rate !== undefined) {
      updates.push('selling_rate');
      values.push(data.selling_rate);
    }
    if (data.market_rate !== undefined) {
      updates.push('market_rate');
      values.push(data.market_rate);
    }

    if (updates.length === 0) {
      throw new Error('At least one rate must be provided');
    }

    // Execute update using raw SQL
    await this.prisma.client.$executeRaw`
      UPDATE currency
      SET buying_rate = COALESCE(${data.buying_rate ?? null}::numeric, buying_rate),
          selling_rate = COALESCE(${data.selling_rate ?? null}::numeric, selling_rate),
          market_rate = COALESCE(${data.market_rate ?? null}::numeric, market_rate)
      WHERE UPPER(currency_init) = UPPER(${currencyInit})
    `;

    // Get updated rate
    const updated = await this.getRateByInit(currencyInit);

    const afterData: UpdateRateDto = {
      buying_rate: updated.buying_rate ?? undefined,
      selling_rate: updated.selling_rate ?? undefined,
      market_rate: updated.market_rate ?? undefined,
    };

    // Create audit log
    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'RATE_UPDATED',
        detail: {
          resourceType: 'CURRENCY_RATE',
          resourceId: currencyInit.toUpperCase(),
          currency_init: updated.currency_init,
          currency_name: updated.currency_name,
          before: {
            buying_rate: beforeData.buying_rate ?? null,
            selling_rate: beforeData.selling_rate ?? null,
            market_rate: beforeData.market_rate ?? null,
          },
          after: {
            buying_rate: afterData.buying_rate ?? null,
            selling_rate: afterData.selling_rate ?? null,
            market_rate: afterData.market_rate ?? null,
          },
        },
      },
    });

    return { data: updated, beforeData, afterData };
  }
}
