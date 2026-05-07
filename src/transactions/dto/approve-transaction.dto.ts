import { IsOptional, IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveTransactionDto {
  @ApiProperty({
    description: 'Transaction type (optional, auto-detected if not provided)',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['transaction_history', 'wallet_transfer', 'fiat_transfer'])
  type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer';

  @ApiProperty({
    description: 'Blockchain transaction hash / payment reference for this approval',
    required: false,
    example: 'abc123def456...',
  })
  @IsOptional()
  @IsString()
  txHash?: string;

  @ApiProperty({
    description: 'Optional notes about the approval',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTransactionHashDto {
  @ApiProperty({
    description: 'Blockchain transaction hash to record for this transaction',
    example: 'abc123def456...',
  })
  @IsNotEmpty()
  @IsString()
  txHash!: string;

  @ApiProperty({
    description: 'Transaction table type (optional, auto-detected if not provided)',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['transaction_history', 'wallet_transfer', 'fiat_transfer'])
  type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer';
}
