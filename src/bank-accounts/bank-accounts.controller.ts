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
    @Query('currency') currency?: string,
  ) {
    return this.bankAccountsService.getAccounts({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      search,
      country,
      currency,
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
   * Get bank accounts for a specific user (must be before :id to avoid matching)
   */
  @Get('user/:userId')
  @RequirePermission(Permission.READ_USERS)
  async getUserAccounts(@Param('userId') userId: string) {
    return this.bankAccountsService.getUserAccounts(parseInt(userId, 10));
  }

  /**
   * Get fiat account by id (UUID)
   */
  @Get(':id')
  @RequirePermission(Permission.READ_USERS)
  async getAccount(@Param('id') id: string) {
    const account = await this.bankAccountsService.getAccount(id);
    if (!account) {
      return { error: 'Fiat account not found' };
    }
    return account;
  }

  /**
   * Delete a fiat account (admin action)
   */
  @Delete(':id')
  @RequirePermission(Permission.SUSPEND_USERS)
  async deleteAccount(
    @Param('id') id: string,
    @Request() req: { user: { id: number } },
  ) {
    return this.bankAccountsService.deleteAccount(id, req.user.id);
  }
}
