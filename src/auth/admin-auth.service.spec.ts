/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthService } from './admin-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { AdminAuthAuditService } from './admin-audit.service';
import { MfaService } from './mfa.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  // Services used by the module but not directly tested
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mailService: jest.Mocked<MailService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let auditService: jest.Mocked<AdminAuthAuditService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mfaService: jest.Mocked<MfaService>;

  const mockAdmin = {
    id: 1,
    email: 'admin@example.com',
    firstName: 'Test',
    lastName: 'Admin',
    password: '$2b$10$hashedpassword',
    status: 'ACTIVE',
    role: 'SUPER_ADMIN',
    mfaEnabled: false,
    mfaSecret: null,
    departmentId: null,
    roleId: null,
  };

  beforeEach(async () => {
    const mockPrismaClient = {
      adminUser: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      adminRefreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendAdminPasswordSetupLink: jest.fn(),
            sendAdminPasswordResetLink: jest.fn(),
          },
        },
        {
          provide: AdminAuthAuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: MfaService,
          useValue: {
            generateSecret: jest.fn(),
            generateQRCode: jest.fn(),
            verifyToken: jest.fn(),
            generateBackupCodes: jest.fn(),
            verifyBackupCode: jest.fn(),
            removeBackupCode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    auditService = module.get(AdminAuthAuditService);
    mfaService = module.get(MfaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateAdmin', () => {
    it('should return admin if credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const adminWithPassword = { ...mockAdmin, password: hashedPassword };

      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(adminWithPassword);

      const result = await service.validateAdmin(
        'admin@example.com',
        'password123',
      );

      expect(result).toEqual(adminWithPassword);

      expect(prismaService.client.adminUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' },
      });
    });

    it('should throw UnauthorizedException if admin not found', async () => {
      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.validateAdmin('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const adminWithPassword = { ...mockAdmin, password: hashedPassword };

      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(adminWithPassword);

      await expect(
        service.validateAdmin('admin@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if admin is inactive', async () => {
      const inactiveAdmin = { ...mockAdmin, status: 'INACTIVE' };

      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(inactiveAdmin);

      await expect(
        service.validateAdmin('admin@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if IP not in allowlist', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const adminWithIpRestriction = {
        ...mockAdmin,
        password: hashedPassword,
        allowedIps: ['192.168.1.1', '10.0.0.1'],
      };

      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(adminWithIpRestriction);

      await expect(
        service.validateAdmin('admin@example.com', 'password123', '172.16.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('setPassword', () => {
    it('should throw BadRequestException if passwords do not match', async () => {
      await expect(
        service.setPassword({
          token: 'validtoken',
          newPassword: 'password123',
          confirmPassword: 'differentpassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(
        service.setPassword({
          token: 'invalidtoken',
          newPassword: 'password123',
          confirmPassword: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestException if new passwords do not match', async () => {
      await expect(
        service.changePassword(1, {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'differentpassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if current password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const adminWithPassword = { ...mockAdmin, password: hashedPassword };

      (
        prismaService.client.adminUser.findUnique as jest.Mock
      ).mockResolvedValue(adminWithPassword);

      await expect(
        service.changePassword(1, {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('MFA', () => {
    describe('startMfaSetup', () => {
      it('should throw BadRequestException if MFA is already enabled', async () => {
        const adminWithMfa = { ...mockAdmin, mfaEnabled: true };

        (
          prismaService.client.adminUser.findUnique as jest.Mock
        ).mockResolvedValue(adminWithMfa);

        await expect(service.startMfaSetup(1)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('disableMfa', () => {
      it('should throw BadRequestException if MFA is not enabled', async () => {
        (
          prismaService.client.adminUser.findUnique as jest.Mock
        ).mockResolvedValue(mockAdmin);

        await expect(service.disableMfa(1)).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });
});
