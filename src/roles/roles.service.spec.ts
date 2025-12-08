/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Permission } from '../auth/permissions.enum';

describe('RolesService', () => {
  let service: RolesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockRole = {
    id: 1,
    title: 'Compliance Officer',
    description: 'Handles compliance tasks',
    status: 'ACTIVE',
    createdById: 1,
    lastUpdatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [
      { id: 1, roleId: 1, permission: 'READ_TRANSACTIONS', isActive: true },
      { id: 2, roleId: 1, permission: 'VERIFY_TRANSACTIONS', isActive: true },
    ],
    _count: { adminUsers: 2 },
  };

  beforeEach(async () => {
    const mockPrismaClient = {
      role: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a role with permissions', async () => {
      // Mock findFirst to return null (no duplicate)
      (prismaService.client.role.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.client.role.create as jest.Mock).mockResolvedValue(
        mockRole,
      );

      const result = await service.create(
        {
          title: 'Compliance Officer',
          description: 'Handles compliance tasks',
          permissions: [
            Permission.READ_TRANSACTIONS,
            Permission.VERIFY_TRANSACTIONS,
          ],
        },
        1,
      );

      expect(result).toBeDefined();
      expect(result.title).toBe('Compliance Officer');

      expect(prismaService.client.role.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all roles with admin counts', async () => {
      (prismaService.client.role.findMany as jest.Mock).mockResolvedValue([
        mockRole,
      ]);

      const result = await service.findAll();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].title).toBe('Compliance Officer');
    });
  });

  describe('findOne', () => {
    it('should return a role by ID', async () => {
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        mockRole,
      );

      const result = await service.findOne(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if role not found', async () => {
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a role', async () => {
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        mockRole,
      );
      // Mock findFirst to return null (no duplicate title)
      (prismaService.client.role.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.client.role.update as jest.Mock).mockResolvedValue({
        ...mockRole,
        title: 'Updated Title',
      });
      (
        prismaService.client.rolePermission.deleteMany as jest.Mock
      ).mockResolvedValue({
        count: 2,
      });
      (
        prismaService.client.rolePermission.createMany as jest.Mock
      ).mockResolvedValue({
        count: 2,
      });

      const result = await service.update(
        1,
        { title: 'Updated Title', permissions: [Permission.READ_TRANSACTIONS] },
        1,
      );

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if role not found', async () => {
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.update(999, { title: 'New Title' }, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a role if no admins assigned', async () => {
      const roleWithNoAdmins = { ...mockRole, _count: { adminUsers: 0 } };
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        roleWithNoAdmins,
      );
      (prismaService.client.role.delete as jest.Mock).mockResolvedValue(
        roleWithNoAdmins,
      );

      const result = await service.remove(1);

      expect(result).toBeDefined();

      expect(prismaService.client.role.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException if admins are assigned to role', async () => {
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        mockRole,
      );

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if role not found', async () => {
      (prismaService.client.role.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
