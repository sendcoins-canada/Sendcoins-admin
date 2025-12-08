import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from './get-transactions.dto';

export class UpdateTransactionStatusDto {
  @ApiProperty({
    description: 'Transaction type (optional, auto-detected if not provided)',
    enum: ['transaction_history', 'wallet_transfer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['transaction_history', 'wallet_transfer'])
  type?: 'transaction_history' | 'wallet_transfer';

  @ApiProperty({
    description: 'New transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Optional notes about the status change',
    example: 'Payment verified and confirmed',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
