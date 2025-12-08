import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from './get-transactions.dto';

class TransactionIdentifier {
  @ApiProperty({
    description: 'Transaction ID',
    example: 1,
  })
  id!: number;

  @ApiProperty({
    description: 'Transaction type',
    enum: ['transaction_history', 'wallet_transfer'],
    example: 'transaction_history',
  })
  @IsEnum(['transaction_history', 'wallet_transfer'])
  type!: 'transaction_history' | 'wallet_transfer';
}

export class BulkUpdateStatusDto {
  @ApiProperty({
    description: 'Array of transaction identifiers',
    type: [TransactionIdentifier],
    example: [
      { id: 1, type: 'transaction_history' },
      { id: 2, type: 'wallet_transfer' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionIdentifier)
  transactionIds!: TransactionIdentifier[];

  @ApiProperty({
    description: 'New status to apply',
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Optional notes about the status change',
    example: 'Bulk verification completed',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkFlagDto {
  @ApiProperty({
    description: 'Array of transaction identifiers',
    type: [TransactionIdentifier],
    example: [
      { id: 1, type: 'transaction_history' },
      { id: 2, type: 'wallet_transfer' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionIdentifier)
  transactionIds!: TransactionIdentifier[];

  @ApiProperty({
    description: 'Reason for flagging',
    example: 'Suspicious activity detected',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
