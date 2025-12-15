import { ApiProperty } from '@nestjs/swagger';

export class TransactionSourceDestinationDto {
  @ApiProperty()
  address!: string;

  @ApiProperty({ enum: ['WALLET', 'BANK', 'MERCHANT'] })
  type!: 'WALLET' | 'BANK' | 'MERCHANT';

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  network?: string;
}

export class TransactionAmountDto {
  @ApiProperty({ required: false })
  crypto?: number;

  @ApiProperty({ required: false })
  fiat?: number;

  @ApiProperty()
  display!: string;
}

export class TransactionMerchantDto {
  @ApiProperty()
  keychain!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ required: false })
  bankName?: string;

  @ApiProperty({ required: false })
  bankAccount?: string;
}

export class UnifiedTransactionResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  txId!: string;

  @ApiProperty()
  reference!: string;

  @ApiProperty({
    enum: ['INCOMING', 'OUTGOING', 'CONVERSION'],
  })
  type!: 'INCOMING' | 'OUTGOING' | 'CONVERSION';

  @ApiProperty({
    enum: ['BUY_SELL', 'WALLET_TRANSFER', 'FIAT_TRANSFER'],
  })
  transactionCategory!: 'BUY_SELL' | 'WALLET_TRANSFER' | 'FIAT_TRANSFER';

  @ApiProperty()
  dateInitiated!: Date;

  @ApiProperty({ type: Object })
  currency!: {
    crypto?: string;
    fiat?: string;
    display: string;
  };

  @ApiProperty({ type: TransactionAmountDto })
  amount!: TransactionAmountDto;

  @ApiProperty({ required: false })
  fee?: number;

  @ApiProperty({
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
  })
  status!: string;

  @ApiProperty()
  isFlagged!: boolean;

  @ApiProperty({ required: false })
  flaggedAt?: Date;

  @ApiProperty({ required: false })
  flaggedBy?: string;

  @ApiProperty({ required: false })
  flaggedReason?: string;

  @ApiProperty({ type: TransactionSourceDestinationDto })
  source!: TransactionSourceDestinationDto;

  @ApiProperty({ type: TransactionSourceDestinationDto })
  destination!: TransactionSourceDestinationDto;

  @ApiProperty({ required: false })
  txHash?: string;

  @ApiProperty({ required: false })
  network?: string;

  @ApiProperty({ type: TransactionMerchantDto, required: false })
  merchant?: TransactionMerchantDto;

  @ApiProperty({ required: false })
  paymentMethod?: string;

  @ApiProperty({ required: false })
  paymentProofUrl?: string;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty({ required: false })
  statusUpdatedBy?: string;

  @ApiProperty({ required: false })
  statusUpdatedAt?: Date;

  @ApiProperty({ required: false })
  statusNotes?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}

export class TransactionStatsResponseDto {
  @ApiProperty({ type: Object })
  totalVolume!: {
    crypto: number;
    fiat: number;
  };

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  flagged!: number;

  @ApiProperty({ type: Object })
  byType!: {
    incoming: number;
    outgoing: number;
    conversion: number;
  };

  @ApiProperty({ required: false })
  pendingChange?: number;

  @ApiProperty({ required: false })
  failedChange?: number;

  @ApiProperty({ required: false })
  flaggedChange?: number;
}

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [UnifiedTransactionResponseDto] })
  data!: UnifiedTransactionResponseDto[];

  @ApiProperty({ type: Object })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
