import { IsOptional, IsInt, IsString, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum CryptoType {
  BTC = 'btc',
  ETH = 'eth',
  BNB = 'bnb',
  SOL = 'sol',
  TRX = 'trx',
  USDT = 'usdt',
  USDC = 'usdc',
  POL = 'pol',
  LTC = 'ltc',
}

export class GetWalletsQueryDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page (max 100)',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by cryptocurrency type',
    required: false,
    enum: CryptoType,
  })
  @IsOptional()
  @IsEnum(CryptoType)
  crypto?: CryptoType;

  @ApiProperty({
    description: 'Filter by user ID (azer_id)',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiProperty({
    description: 'Search by wallet address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Filter by freeze status',
    required: false,
  })
  @IsOptional()
  @IsString()
  frozen?: string;
}
