import { ApiProperty } from '@nestjs/swagger';

export class TransactionSourceDestinationDto {
  @ApiProperty({ example: '0X23423 ERC 20' })
  address!: string;

  @ApiProperty({ enum: ['WALLET', 'BANK', 'MERCHANT'], example: 'WALLET' })
  type!: 'WALLET' | 'BANK' | 'MERCHANT';

  @ApiProperty({ example: 'Binance Wallet', required: false })
  name?: string;

  @ApiProperty({ example: 'ethereum', required: false })
  network?: string;
}

export class TransactionAmountDto {
  @ApiProperty({ example: 0.5, required: false })
  crypto?: number;

  @ApiProperty({ example: 20000, required: false })
  fiat?: number;

  @ApiProperty({ example: 'N20,000 ~$10' })
  display!: string;
}

export class TransactionMerchantDto {
  @ApiProperty({ example: 'abc12345' })
  keychain!: string;

  @ApiProperty({ example: 'John Doe' })
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  email!: string;

  @ApiProperty({ example: 'UBA', required: false })
  bankName?: string;

  @ApiProperty({ example: '1234567890', required: false })
  bankAccount?: string;
}

export class UnifiedTransactionResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '902A3' })
  txId!: string;

  @ApiProperty({ example: '0fdu14uuuzdyvplw1rawsflcubetcgc5znna' })
  reference!: string;

  @ApiProperty({ enum: ['INCOMING', 'OUTGOING', 'CONVERSION'], example: 'OUTGOING' })
  type!: 'INCOMING' | 'OUTGOING' | 'CONVERSION';

  @ApiProperty({ enum: ['BUY_SELL', 'WALLET_TRANSFER'], example: 'WALLET_TRANSFER' })
  transactionCategory!: 'BUY_SELL' | 'WALLET_TRANSFER';

  @ApiProperty({ example: '2025-11-02T21:30:00Z' })
  dateInitiated!: Date;

  @ApiProperty({ type: Object })
  currency!: {
    crypto?: string;
    fiat?: string;
    display: string;
  };

  @ApiProperty({ type: TransactionAmountDto })
  amount!: TransactionAmountDto;

  @ApiProperty({ example: 2000, required: false })
  fee?: number;

  @ApiProperty({ enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'], example: 'completed' })
  status!: string;

  @ApiProperty({ example: false })
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

  @ApiProperty({ example: '0x123...', required: false })
  txHash?: string;

  @ApiProperty({ example: 'ethereum', required: false })
  network?: string;

  @ApiProperty({ type: TransactionMerchantDto, required: false })
  merchant?: TransactionMerchantDto;

  @ApiProperty({ example: 'bank_transfer', required: false })
  paymentMethod?: string;

  @ApiProperty({ example: 'https://example.com/proof.pdf', required: false })
  paymentProofUrl?: string;

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty({ required: false })
  statusUpdatedBy?: string;

  @ApiProperty({ required: false })
  statusUpdatedAt?: Date;

  @ApiProperty({ required: false })
  statusNotes?: string;

  @ApiProperty({ example: '2025-11-02T21:30:00Z' })
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

  @ApiProperty({ example: 12380 })
  completed!: number;

  @ApiProperty({ example: 3000 })
  pending!: number;

  @ApiProperty({ example: 3000 })
  failed!: number;

  @ApiProperty({ example: 3000 })
  flagged!: number;

  @ApiProperty({ type: Object })
  byType!: {
    incoming: number;
    outgoing: number;
    conversion: number;
  };

  @ApiProperty({ example: 3.5, required: false })
  pendingChange?: number;

  @ApiProperty({ example: 3.5, required: false })
  failedChange?: number;

  @ApiProperty({ example: 3.5, required: false })
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



