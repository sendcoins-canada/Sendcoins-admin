import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  /**
   * Get all bank accounts with pagination and filters
   */
  @Get()
  @RequirePermission(Permission.READ_USERS)
  async getAccounts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('flagged') flagged?: string,
  ) {
    return this.bankAccountsService.getAccounts({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      search,
      country,
      flagged: flagged === 'true',
    });
  }

  /**
   * Get bank account statistics
   */
  @Get('stats')
  @RequirePermission(Permission.READ_USERS)
  async getStats() {
    return this.bankAccountsService.getStats();
  }

  /**
   * Get bank account by keychain
   */
  @Get(':keychain')
  @RequirePermission(Permission.READ_USERS)
  async getAccount(@Param('keychain') keychain: string) {
    const account = await this.bankAccountsService.getAccount(keychain);
    if (!account) {
      return { error: 'Bank account not found' };
    }
    return account;
  }

  /**
   * Get bank accounts for a specific user
   */
  @Get('user/:userId')
  @RequirePermission(Permission.READ_USERS)
  async getUserAccounts(@Param('userId') userId: string) {
    return this.bankAccountsService.getUserAccounts(parseInt(userId, 10));
  }

  /**
   * Delete a bank account (admin action)
   */
  @Delete(':keychain')
  @RequirePermission(Permission.SUSPEND_USERS)
  async deleteAccount(
    @Param('keychain') keychain: string,
    @Request() req: { user: { id: number } },
  ) {
    return this.bankAccountsService.deleteAccount(keychain, req.user.id);
  }
}
