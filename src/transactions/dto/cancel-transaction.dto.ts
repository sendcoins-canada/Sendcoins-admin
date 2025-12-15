import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelTransactionDto {
  @ApiProperty({
    description: 'Transaction type (optional, auto-detected if not provided)',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['transaction_history', 'wallet_transfer', 'fiat_transfer'])
  type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer';

  @ApiProperty({
    description: 'Reason for cancellation',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
