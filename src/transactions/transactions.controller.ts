import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  GetTransactionsDto,
  TransactionType,
  TransactionStatus,
  SortBy,
  SortOrder,
} from './dto/get-transactions.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { FlagTransactionDto } from './dto/flag-transaction.dto';
import { BulkUpdateStatusDto, BulkFlagDto } from './dto/bulk-action.dto';
import { VerifyTransactionDto } from './dto/verify-transaction.dto';
import { ApproveTransactionDto } from './dto/approve-transaction.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import {
  UnifiedTransactionResponseDto,
  TransactionStatsResponseDto,
  PaginatedTransactionsResponseDto,
} from './dto/transaction-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

// Authenticated request type
interface AuthenticatedRequest extends Request {
  user: { id: number; email: string; role: string };
}

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('stats')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get transaction statistics',
    description: 'Returns aggregated statistics for all transactions',
  })
  @ApiQuery({
    name: 'type',
    enum: TransactionType,
    required: false,
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'dateFrom',
    type: String,
    required: false,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'dateTo',
    type: String,
    required: false,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction statistics',
    type: TransactionStatsResponseDto,
  })
  async getStats(
    @Query('type') type?: TransactionType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<TransactionStatsResponseDto> {
    return this.transactionsService.getStats(
      type,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get()
  @RequirePermission(Permission.READ_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get all transactions',
    description: 'Returns a paginated list of transactions with filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
    type: PaginatedTransactionsResponseDto,
  })
  async findAll(
    @Query() dto: GetTransactionsDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.transactionsService.findAll(dto);
  }

  @Get('pending-approvals')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get transactions pending approval',
    description: 'Returns transactions that are pending or flagged for review',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPendingApprovals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedTransactionsResponseDto> {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20));
    return this.transactionsService.findAll({
      page: pageNum,
      limit: limitNum,
      status: TransactionStatus.PENDING,
      sortBy: SortBy.CREATED_AT,
      sortOrder: SortOrder.DESC,
    });
  }

  @Get(':id')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get a single transaction',
    description: 'Returns details for a specific transaction',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiQuery({
    name: 'type',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
    description: 'Transaction type (auto-detected if not provided)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('type')
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.findOne(id, type);
  }

  @Patch(':id/status')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Update transaction status',
    description: 'Updates the status of a transaction',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated transaction',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.updateStatus(id, dto, req.user.id);
  }

  @Post(':id/flag')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Flag a transaction',
    description: 'Flags a transaction for review',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Flagged transaction',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async flagTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FlagTransactionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.flagTransaction(id, dto, req.user.id);
  }

  @Delete(':id/flag')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Unflag a transaction',
    description: 'Removes the flag from a transaction',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Unflagged transaction',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async unflagTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Query('type')
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.unflagTransaction(id, type);
  }

  @Post('bulk/status')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Bulk update transaction status',
    description: 'Updates the status of multiple transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update results',
    schema: {
      type: 'object',
      properties: {
        updated: { type: 'number' },
        failed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async bulkUpdateStatus(
    @Body() dto: BulkUpdateStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    updated: number;
    failed: Array<{ id: number; error: string }>;
  }> {
    return this.transactionsService.bulkUpdateStatus(dto, req.user.id);
  }

  @Post('bulk/flag')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Bulk flag transactions',
    description: 'Flags multiple transactions for review',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk flag results',
    schema: {
      type: 'object',
      properties: {
        flagged: { type: 'number' },
        failed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async bulkFlag(
    @Body() dto: BulkFlagDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    flagged: number;
    failed: Array<{ id: number; error: string }>;
  }> {
    return this.transactionsService.bulkFlag(dto, req.user.id);
  }

  @Get('export')
  @RequirePermission(Permission.EXPORT_TRANSACTIONS)
  @ApiOperation({
    summary: 'Export transactions',
    description:
      'Exports transactions to CSV format with the same filters as the list endpoint',
  })
  @ApiQuery({
    name: 'format',
    enum: ['csv', 'json'],
    required: false,
    description: 'Export format (defaults to csv)',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file download',
    headers: {
      'Content-Type': { schema: { type: 'string' } },
      'Content-Disposition': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  async exportTransactions(
    @Query() dto: GetTransactionsDto,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    const result = await this.transactionsService.exportTransactions(
      dto,
      format,
    );

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="transactions-${Date.now()}.json"`,
      );
      return res.send(JSON.stringify(result.data, null, 2));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transactions-${Date.now()}.csv"`,
    );
    return res.send(result.csv);
  }

  @Post(':id/verify')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Verify transaction with hash',
    description: 'Verifies a transaction using the provided transaction hash',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Verified transaction',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  @ApiResponse({ status: 400, description: 'Invalid transaction hash' })
  async verifyTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyTransactionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.verifyTransaction(id, dto, req.user.id);
  }

  @Post(':id/approve')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Approve transaction',
    description: 'Approves a transaction, setting its status to completed',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Approved transaction',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async approveTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveTransactionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.approveTransaction(id, dto, req.user.id);
  }

  @Post(':id/cancel')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Cancel transaction',
    description: 'Cancels a transaction, setting its status to cancelled',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Cancelled transaction',
    type: UnifiedTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async cancelTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelTransactionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.cancelTransaction(id, dto, req.user.id);
  }

  @Get(':id/user')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get user details for a transaction',
    description: 'Returns user information associated with a transaction',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiQuery({
    name: 'type',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
    description: 'Transaction type (auto-detected if not provided)',
  })
  @ApiResponse({
    status: 200,
    description: 'User details',
    schema: {
      type: 'object',
      properties: {
        azer_id: { type: 'number' },
        first_name: { type: 'string', nullable: true },
        last_name: { type: 'string', nullable: true },
        user_email: { type: 'string', nullable: true },
        verify_user: { type: 'boolean', nullable: true },
        device: { type: 'string', nullable: true },
        ip_addr: { type: 'string', nullable: true },
        country: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        account_ban: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transaction or user not found' })
  async getTransactionUser(
    @Param('id', ParseIntPipe) id: number,
    @Query('type')
    type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer',
  ) {
    return this.transactionsService.getTransactionUser(id, type);
  }
}
