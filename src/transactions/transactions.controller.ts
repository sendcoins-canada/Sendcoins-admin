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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { GetTransactionsDto, TransactionType } from './dto/get-transactions.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { FlagTransactionDto } from './dto/flag-transaction.dto';
import { BulkUpdateStatusDto, BulkFlagDto } from './dto/bulk-action.dto';
import {
  UnifiedTransactionResponseDto,
  TransactionStatsResponseDto,
  PaginatedTransactionsResponseDto,
} from './dto/transaction-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

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
    enum: ['transaction_history', 'wallet_transfer'],
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
    @Query('type') type?: 'transaction_history' | 'wallet_transfer',
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
    @Req() req: any,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.updateStatus(id, dto, req.user.sub);
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
    @Req() req: any,
  ): Promise<UnifiedTransactionResponseDto> {
    return this.transactionsService.flagTransaction(id, dto, req.user.sub);
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
    @Query('type') type?: 'transaction_history' | 'wallet_transfer',
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
        updated: { type: 'number', example: 5 },
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
    @Req() req: any,
  ): Promise<{ updated: number; failed: Array<{ id: number; error: string }> }> {
    return this.transactionsService.bulkUpdateStatus(dto, req.user.sub);
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
        flagged: { type: 'number', example: 5 },
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
    @Req() req: any,
  ): Promise<{ flagged: number; failed: Array<{ id: number; error: string }> }> {
    return this.transactionsService.bulkFlag(dto, req.user.sub);
  }

  @Get('export')
  @RequirePermission(Permission.READ_TRANSACTIONS)
  @ApiOperation({
    summary: 'Export transactions',
    description: 'Exports transactions to CSV/Excel format',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file download',
    headers: {
      'Content-Type': { schema: { type: 'string', example: 'text/csv' } },
      'Content-Disposition': {
        schema: { type: 'string', example: 'attachment; filename="transactions.csv"' },
      },
    },
  })
  async exportTransactions(@Query() dto: GetTransactionsDto) {
    // TODO: Implement CSV/Excel export
    throw new Error('Export functionality not yet implemented');
  }
}

