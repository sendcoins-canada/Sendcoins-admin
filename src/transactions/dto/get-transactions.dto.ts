import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum TransactionType {
  ALL = 'all',
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  CONVERSION = 'conversion',
  BUY_SELL = 'buy_sell',
  WALLET_TRANSFER = 'wallet_transfer',
  FIAT_TRANSFER = 'fiat_transfer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum SortBy {
  CREATED_AT = 'created_at',
  AMOUNT = 'amount',
  STATUS = 'status',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetTransactionsDto {
  @ApiProperty({
    description: 'Page number (1-indexed)',
    required: false,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by transaction type',
    enum: TransactionType,
    required: false,
    default: TransactionType.ALL,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType = TransactionType.ALL;

  @ApiProperty({
    description: 'Filter by transaction status',
    enum: TransactionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: 'Filter by currency (crypto or fiat)',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Filter by asset type',
    required: false,
  })
  @IsOptional()
  @IsEnum(['crypto', 'fiat'])
  asset?: 'crypto' | 'fiat';

  @ApiProperty({
    description: 'Filter by date from (ISO 8601 format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter by date to (ISO 8601 format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Filter by flagged status',
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  flagged?: boolean;

  @ApiProperty({
    description: 'Search by TX ID, reference, keychain, or user_api_key',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Sort by field',
    enum: SortBy,
    required: false,
    default: SortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.CREATED_AT;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    required: false,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
