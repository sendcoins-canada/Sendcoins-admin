import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { RatesService, UpdateRateDto, RateHistoryItem } from './rates.service';
import type { CurrencyRate } from './rates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MfaActionGuard } from '../auth/mfa-action.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RequireMfa } from '../auth/require-mfa.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('admin/rates')
@UseGuards(JwtAuthGuard, PermissionsGuard, MfaActionGuard)
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  /**
   * Get all currency rates
   */
  @Get()
  @RequirePermission(Permission.READ_RATES)
  async getAllRates(): Promise<{ success: boolean; data: CurrencyRate[] }> {
    const rates = await this.ratesService.getAllRates();
    return { success: true, data: rates };
  }

  /**
   * Get rate change history for a currency
   * NOTE: This must be defined BEFORE :currencyInit to avoid route conflicts
   */
  @Get('history/:currencyInit')
  @RequirePermission(Permission.READ_RATES)
  async getRateHistory(
    @Param('currencyInit') currencyInit: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: RateHistoryItem[] }> {
    const history = await this.ratesService.getRateHistory(
      currencyInit,
      limit ? parseInt(limit, 10) : 50,
    );
    return { success: true, data: history };
  }

  /**
   * Get a single currency rate by currency_init (e.g., 'NGN', 'USD')
   */
  @Get(':currencyInit')
  @RequirePermission(Permission.READ_RATES)
  async getRateByInit(
    @Param('currencyInit') currencyInit: string,
  ): Promise<{ success: boolean; data: CurrencyRate }> {
    const rate = await this.ratesService.getRateByInit(currencyInit);
    return { success: true, data: rate };
  }

  /**
   * Update currency rates (requires MFA)
   */
  @Patch(':currencyInit')
  @RequirePermission(Permission.UPDATE_RATES)
  @RequireMfa()
  async updateRate(
    @Param('currencyInit') currencyInit: string,
    @Body() body: UpdateRateDto,
    @Request() req: { user: { id: number } },
  ): Promise<{
    success: boolean;
    message: string;
    data: CurrencyRate;
    beforeData?: UpdateRateDto;
    afterData?: UpdateRateDto;
  }> {
    // Validate input
    if (
      body.buying_rate === undefined &&
      body.selling_rate === undefined &&
      body.market_rate === undefined
    ) {
      throw new BadRequestException(
        'At least one rate (buying_rate, selling_rate, or market_rate) must be provided',
      );
    }

    // Validate rate values
    if (body.buying_rate !== undefined && (isNaN(body.buying_rate) || body.buying_rate < 0)) {
      throw new BadRequestException('Invalid buying rate');
    }
    if (body.selling_rate !== undefined && (isNaN(body.selling_rate) || body.selling_rate < 0)) {
      throw new BadRequestException('Invalid selling rate');
    }
    if (body.market_rate !== undefined && (isNaN(body.market_rate) || body.market_rate < 0)) {
      throw new BadRequestException('Invalid market rate');
    }

    const result = await this.ratesService.updateRate(currencyInit, body, req.user.id);

    return {
      success: true,
      message: 'Rate updated successfully',
      data: result.data,
      beforeData: result.beforeData,
      afterData: result.afterData,
    };
  }
}
