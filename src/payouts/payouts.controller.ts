import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MfaActionGuard } from '../auth/mfa-action.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

/**
 * CrayFi NGN payouts — read-only view showing our status alongside CrayFi's
 * real outcome (status + failure_reason), so payout failures like PMN-13-422
 * are visible in the admin.
 */
@Controller('admin/payouts')
@UseGuards(JwtAuthGuard, PermissionsGuard, MfaActionGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @RequirePermission(Permission.READ_TRANSACTIONS)
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.payoutsService.list({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
    });
    return { success: true, ...data };
  }

  @Get('stats')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  async stats() {
    const data = await this.payoutsService.stats();
    return { success: true, data };
  }
}
