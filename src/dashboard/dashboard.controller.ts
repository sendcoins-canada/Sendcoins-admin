import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get dashboard overview',
    description:
      'Returns aggregated statistics for the dashboard including users, transactions, platform stats, and KYC. Requires VIEW_DASHBOARD permission.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview data',
  })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('users')
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get user statistics',
    description: 'Returns detailed user statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics',
  })
  getUserStats() {
    return this.dashboardService.getUserStats();
  }

  @Get('transactions')
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get transaction statistics',
    description: 'Returns detailed transaction statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction statistics',
  })
  getTransactionStats() {
    return this.dashboardService.getTransactionStats();
  }

  @Get('platform')
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get platform statistics',
    description: 'Returns platform wallet balances and revenue.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics',
  })
  getPlatformStats() {
    return this.dashboardService.getPlatformStats();
  }

  @Get('charts')
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get chart data',
    description: 'Returns time-series data for charts.',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'year'],
    description: 'Time period for chart data',
  })
  @ApiResponse({
    status: 200,
    description: 'Chart data',
  })
  getChartData(@Query('period') period?: 'week' | 'month' | 'year') {
    return this.dashboardService.getChartData(period || 'month');
  }

  @Get('pending')
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get pending items count',
    description: 'Returns counts of items requiring admin attention.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending items count',
  })
  getPendingItems() {
    return this.dashboardService.getPendingItems();
  }
}
