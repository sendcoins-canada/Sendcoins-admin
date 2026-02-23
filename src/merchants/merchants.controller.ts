import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('merchants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  /**
   * Get all merchants with pagination and filters
   */
  @Get()
  @RequirePermission(Permission.READ_USERS)
  async getMerchants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('active') active?: string,
  ) {
    return this.merchantsService.getMerchants({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      search,
      status,
      active: active === undefined ? undefined : active === 'true',
    });
  }

  /**
   * Get merchant statistics
   */
  @Get('stats')
  @RequirePermission(Permission.READ_USERS)
  async getStats() {
    return this.merchantsService.getStats();
  }

  /**
   * Get merchant by keychain
   */
  @Get(':keychain')
  @RequirePermission(Permission.READ_USERS)
  async getMerchant(@Param('keychain') keychain: string) {
    const merchant = await this.merchantsService.getMerchant(keychain);
    if (!merchant) {
      return { error: 'Merchant not found' };
    }
    return merchant;
  }

  /**
   * Get merchant's transaction history
   */
  @Get(':keychain/transactions')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  async getMerchantTransactions(
    @Param('keychain') keychain: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.merchantsService.getMerchantTransactions(keychain, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
    });
  }

  /**
   * Approve a merchant
   */
  @Post(':keychain/approve')
  @RequirePermission(Permission.VERIFY_KYC)
  async approveMerchant(
    @Param('keychain') keychain: string,
    @Body() body: { notes?: string },
    @Request() req: { user: { id: number } },
  ) {
    return this.merchantsService.approveMerchant(keychain, req.user.id, body.notes);
  }

  /**
   * Reject a merchant
   */
  @Post(':keychain/reject')
  @RequirePermission(Permission.VERIFY_KYC)
  async rejectMerchant(
    @Param('keychain') keychain: string,
    @Body() body: { reason: string },
    @Request() req: { user: { id: number } },
  ) {
    return this.merchantsService.rejectMerchant(keychain, req.user.id, body.reason);
  }

  /**
   * Suspend a merchant
   */
  @Post(':keychain/suspend')
  @RequirePermission(Permission.SUSPEND_USERS)
  async suspendMerchant(
    @Param('keychain') keychain: string,
    @Body() body: { reason: string },
    @Request() req: { user: { id: number } },
  ) {
    return this.merchantsService.suspendMerchant(keychain, req.user.id, body.reason);
  }

  /**
   * Toggle merchant active status
   */
  @Post(':keychain/toggle')
  @RequirePermission(Permission.SUSPEND_USERS)
  async toggleMerchantStatus(
    @Param('keychain') keychain: string,
    @Body() body: { isActive: boolean },
    @Request() req: { user: { id: number } },
  ) {
    return this.merchantsService.toggleMerchantStatus(keychain, req.user.id, body.isActive);
  }
}
