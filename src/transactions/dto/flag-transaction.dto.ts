import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FlagTransactionDto {
  @ApiProperty({
    description: 'Transaction type (optional, auto-detected if not provided)',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['transaction_history', 'wallet_transfer', 'fiat_transfer'])
  type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer';

  @ApiProperty({
    description: 'Reason for flagging the transaction',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
