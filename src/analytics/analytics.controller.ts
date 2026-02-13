import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('transactions')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  @ApiOperation({
    summary: 'Get transaction analytics',
    description:
      'Returns detailed transaction analytics including volume, counts, and breakdowns. Requires VIEW_ANALYTICS permission.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Time grouping',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction analytics data',
  })
  getTransactionAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getTransactionAnalytics({
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('users')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  @ApiOperation({
    summary: 'Get user analytics',
    description:
      'Returns user analytics including registrations, geographic distribution, and verification status. Requires VIEW_ANALYTICS permission.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Time grouping',
  })
  @ApiResponse({
    status: 200,
    description: 'User analytics data',
  })
  getUserAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getUserAnalytics({
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('revenue')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  @ApiOperation({
    summary: 'Get revenue analytics',
    description:
      'Returns revenue analytics including time series and category breakdown. Requires VIEW_ANALYTICS permission.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Time grouping',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue analytics data',
  })
  getRevenueAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getRevenueAnalytics({
      startDate,
      endDate,
      groupBy,
    });
  }

  @Get('top-users')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  @ApiOperation({
    summary: 'Get top users',
    description: 'Returns top users by transaction count or volume.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of users to return',
  })
  @ApiQuery({
    name: 'metric',
    required: false,
    enum: ['transactions', 'volume'],
    description: 'Metric to sort by',
  })
  @ApiResponse({
    status: 200,
    description: 'Top users data',
  })
  getTopUsers(
    @Query('limit') limit?: string,
    @Query('metric') metric?: 'transactions' | 'volume',
  ) {
    return this.analyticsService.getTopUsers({
      limit: limit ? parseInt(limit, 10) : 10,
      metric,
    });
  }
}
