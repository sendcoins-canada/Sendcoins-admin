/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionType, TransactionStatus } from './dto/get-transactions.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockTransactionHistory = {
    history_id: 1,
    user_api_key: 'user-123',
    reference: 'REF-001',
    keychain: 'KC001',
    asset_type: 'crypto',
    option_type: 'buy',
    transaction_type: 'buy',
    crypto_sign: 'BTC',
    crypto_amount: 0.5,
    currency_sign: 'USD',
    currency_amount: 25000,
    status: 'completed',
    created_at: BigInt(Date.now()),
    created_at_timestamp: new Date(),
  };

  const mockWalletTransfer = {
    transfer_id: 1,
    reference: 'TRF-001',
    user_api_key: 'user-123',
    recipient_wallet_address: '0x123...',
    asset: 'ETH',
    network: 'Ethereum',
    amount: 1.5,
    fee: 0.01,
    status: 'pending',
    created_at: BigInt(Date.now()),
    created_at_timestamp: new Date(),
  };

  const mockAdmin = {
    id: 1,
    email: 'admin@example.com',
    firstName: 'Test',
    lastName: 'Admin',
  };

  beforeEach(async () => {
    const mockPrismaClient = {
      transaction_history: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      wallet_transfers: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      adminUser: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return transaction statistics', async () => {
      (prismaService.client.transaction_history.count as jest.Mock)
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2); // failed

      (
        prismaService.client.transaction_history.aggregate as jest.Mock
      ).mockResolvedValue({
        _sum: {
          currency_amount: 100000,
          crypto_amount: 5,
        },
      });

      (prismaService.client.wallet_transfers.count as jest.Mock)
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(3) // pending
        .mockResolvedValueOnce(1); // failed

      (
        prismaService.client.wallet_transfers.aggregate as jest.Mock
      ).mockResolvedValue({
        _sum: {
          amount: 10,
          fee: 0.1,
        },
      });

      const result = await service.getStats();

      expect(result.completed).toBe(18);
      expect(result.pending).toBe(8);
      expect(result.failed).toBe(3);
      expect(result.totalVolume).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a transaction from transaction_history', async () => {
      (
        prismaService.client.transaction_history.findUnique as jest.Mock
      ).mockResolvedValue(mockTransactionHistory);

      const result = await service.findOne(1, 'transaction_history');

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.transactionCategory).toBe('BUY_SELL');
    });

    it('should return a transaction from wallet_transfers', async () => {
      (
        prismaService.client.transaction_history.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.client.wallet_transfers.findUnique as jest.Mock
      ).mockResolvedValue(mockWalletTransfer);

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result.transactionCategory).toBe('WALLET_TRANSFER');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      (
        prismaService.client.transaction_history.findUnique as jest.Mock
      ).mockResolvedValue(null);
      (
        prismaService.client.wallet_transfers.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      (
        prismaService.client.transaction_history.count as jest.Mock
      ).mockResolvedValue(10);
      (
        prismaService.client.wallet_transfers.count as jest.Mock
      ).mockResolvedValue(5);
      (
        prismaService.client.transaction_history.findMany as jest.Mock
      ).mockResolvedValue([mockTransactionHistory]);
      (
        prismaService.client.wallet_transfers.findMany as jest.Mock
      ).mockResolvedValue([mockWalletTransfer]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(15);
    });

    it('should filter by transaction type', async () => {
      (
        prismaService.client.transaction_history.count as jest.Mock
      ).mockResolvedValue(10);
      (
        prismaService.client.wallet_transfers.count as jest.Mock
      ).mockResolvedValue(0);
      (
        prismaService.client.transaction_history.findMany as jest.Mock
      ).mockResolvedValue([mockTransactionHistory]);
      (
        prismaService.client.wallet_transfers.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        type: TransactionType.BUY_SELL,
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].transactionCategory).toBe('BUY_SELL');
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(mockAdmin);
      (
        prismaService.client.transaction_history.findUnique as jest.Mock
      ).mockResolvedValue(mockTransactionHistory);
      (
        prismaService.client.transaction_history.update as jest.Mock
      ).mockResolvedValue({
        ...mockTransactionHistory,
        status: 'completed',
      });

      const result = await service.updateStatus(
        1,
        { status: TransactionStatus.COMPLETED, notes: 'Verified' },
        1,
      );

      expect(result).toBeDefined();

      expect(
        prismaService.client.transaction_history.update,
      ).toHaveBeenCalled();
    });

    it('should throw BadRequestException if admin not found', async () => {
      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.updateStatus(1, { status: TransactionStatus.COMPLETED }, 999),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportTransactions', () => {
    it('should return CSV data', async () => {
      (
        prismaService.client.transaction_history.count as jest.Mock
      ).mockResolvedValue(1);
      (
        prismaService.client.wallet_transfers.count as jest.Mock
      ).mockResolvedValue(0);
      (
        prismaService.client.transaction_history.findMany as jest.Mock
      ).mockResolvedValue([mockTransactionHistory]);
      (
        prismaService.client.wallet_transfers.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.exportTransactions({}, 'csv');

      expect(result.csv).toBeDefined();
      expect(result.csv).toContain('ID,Transaction ID');
      expect(result.data.length).toBe(1);
    });

    it('should return JSON data', async () => {
      (
        prismaService.client.transaction_history.count as jest.Mock
      ).mockResolvedValue(1);
      (
        prismaService.client.wallet_transfers.count as jest.Mock
      ).mockResolvedValue(0);
      (
        prismaService.client.transaction_history.findMany as jest.Mock
      ).mockResolvedValue([mockTransactionHistory]);
      (
        prismaService.client.wallet_transfers.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.exportTransactions({}, 'json');

      expect(result.data).toBeDefined();
      expect(result.csv).toBeUndefined();
    });
  });
});
