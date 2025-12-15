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
  })
  id!: number;

  @ApiProperty({
    description: 'Transaction type',
    enum: ['transaction_history', 'wallet_transfer', 'fiat_transfer'],
  })
  @IsEnum(['transaction_history', 'wallet_transfer', 'fiat_transfer'])
  type!: 'transaction_history' | 'wallet_transfer' | 'fiat_transfer';
}

export class BulkUpdateStatusDto {
  @ApiProperty({
    description: 'Array of transaction identifiers',
    type: [TransactionIdentifier],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionIdentifier)
  transactionIds!: TransactionIdentifier[];

  @ApiProperty({
    description: 'New status to apply',
    enum: TransactionStatus,
  })
  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @ApiProperty({
    description: 'Optional notes about the status change',
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
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionIdentifier)
  transactionIds!: TransactionIdentifier[];

  @ApiProperty({
    description: 'Reason for flagging',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
