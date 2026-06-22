import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import { ActivityService } from './activity.service';
import { GetActivityDto } from './dto/get-activity.dto';
import { PaginatedActivityResponseDto } from './dto/activity-response.dto';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @RequirePermission(Permission.VIEW_DASHBOARD)
  @ApiOperation({
    summary: 'Get the unified platform activity feed',
    description:
      'Chronological stream of signups, transactions, KYC decisions, and admin actions.',
  })
  @ApiResponse({ status: 200, type: PaginatedActivityResponseDto })
  async findAll(
    @Query() dto: GetActivityDto,
  ): Promise<PaginatedActivityResponseDto> {
    return this.activityService.findAll(dto);
  }
}
