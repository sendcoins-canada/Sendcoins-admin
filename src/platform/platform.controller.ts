import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

@ApiTags('Platform')
@ApiBearerAuth()
@Controller('platform')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('balance')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  @ApiOperation({
    summary: 'Get platform wallet balances',
    description: 'Returns the platform fee wallet and hot wallet balances',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform wallet balances',
  })
  async getBalance() {
    const wallets = await this.platformService.getPlatformWallets();
    return wallets;
  }

  @Get('revenue')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  @ApiOperation({
    summary: 'Get platform revenue report',
    description: 'Returns revenue breakdown by category',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
  })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Revenue report',
  })
  async getRevenue(
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    // Calculate date range based on period if not provided
    let startDate = dateFrom;
    let endDate = dateTo;

    if (!startDate && period) {
      const now = new Date();
      switch (period) {
        case 'day':
          startDate = now.toISOString().split('T')[0];
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = weekAgo.toISOString().split('T')[0];
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          startDate = monthAgo.toISOString().split('T')[0];
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          startDate = yearAgo.toISOString().split('T')[0];
          break;
      }
      endDate = now.toISOString().split('T')[0];
    }

    const revenue = await this.platformService.getRevenueReport({
      startDate,
      endDate,
    });

    return revenue;
  }

  @Get('account')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  @ApiOperation({
    summary: 'Get platform account details',
    description: 'Returns the platform CrayFi account details',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform account details',
  })
  async getAccount() {
    const account = await this.platformService.getPlatformAccount();
    if (!account) {
      return {
        exists: false,
        message: 'Platform account not initialized',
      };
    }
    return {
      exists: true,
      ...account,
    };
  }

  @Get('stats')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  @ApiOperation({
    summary: 'Get combined platform statistics',
    description: 'Returns combined stats including fees collected and revenue',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics',
  })
  async getStats() {
    const stats = await this.platformService.getPlatformStats();
    return stats;
  }
}
