import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTransactionDto {
  @ApiProperty({
    description: 'Transaction hash to verify',
    example: '0x8f3a1b7c2d...b9f5a0c4e2d',
  })
  @IsString()
  txHash!: string;

  @ApiProperty({
    description: 'Transaction type (optional, auto-detected if not provided)',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['transaction_history', 'wallet_transfer', 'fiat_transfer'])
  type?: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer';

  @ApiProperty({
    description: 'Optional notes about the verification',
    example: 'Transaction hash verified on blockchain',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
