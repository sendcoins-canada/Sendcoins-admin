import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto, createdById: number) {
    // Check for duplicate title
    const existing = await this.prisma.client.role.findFirst({
      where: { title: dto.title },
    });

    if (existing) {
      throw new ConflictException('Role with this title already exists');
    }

    // Create role with permissions
    type RoleWithIncludes = Prisma.RoleGetPayload<{
      include: {
        permissions: true;
        createdBy: {
          select: { id: true; email: true; firstName: true; lastName: true };
        };
      };
    }>;

    const role = (await this.prisma.client.role.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: RoleStatus.ACTIVE,
        createdById,
        permissions: {
          create: dto.permissions.map((permission) => ({
            permission,
            isActive: true, // All permissions in the table are active
          })),
        },
      },

      include: {
        permissions: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })) as unknown as RoleWithIncludes;

    return this.formatRoleResponse(role);
  }

  async findAll() {
    type RoleWithIncludes = Prisma.RoleGetPayload<{
      include: {
        permissions: true;
        createdBy: {
          select: { id: true; email: true; firstName: true; lastName: true };
        };
        lastUpdatedBy: {
          select: { id: true; email: true; firstName: true; lastName: true };
        };
        _count: { select: { adminUsers: true } };
      };
    }>;

    const roles = (await this.prisma.client.role.findMany({
      include: {
        permissions: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        lastUpdatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })) as unknown as RoleWithIncludes[];

    return roles.map((role) => this.formatRoleResponse(role));
  }

  async findOne(id: number) {
    const role = await this.prisma.client.role.findUnique({
      where: { id },
      include: {
        permissions: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        lastUpdatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return this.formatRoleResponse(role);
  }

  async update(id: number, dto: UpdateRoleDto, updatedById: number) {
    const role = await this.prisma.client.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Check for duplicate title if title is being updated
    if (dto.title && dto.title !== role.title) {
      const existing = await this.prisma.client.role.findFirst({
        where: { title: dto.title },
      });

      if (existing) {
        throw new ConflictException('Role with this title already exists');
      }
    }

    // Update role
    const updateData: Prisma.RoleUpdateInput = {
      ...(dto.title && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status && { status: dto.status }),
      lastUpdatedBy: {
        connect: { id: updatedById },
      },
    };

    // If permissions are being updated, replace all permissions
    if (dto.permissions !== undefined) {
      // Delete existing permissions
      await this.prisma.client.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // Create new permissions (all are active)
      updateData.permissions = {
        create: dto.permissions.map((permission) => ({
          permission,
          isActive: true,
        })),
      };
    }

    type RoleWithIncludes = Prisma.RoleGetPayload<{
      include: {
        permissions: true;
        createdBy: {
          select: { id: true; email: true; firstName: true; lastName: true };
        };
        lastUpdatedBy: {
          select: { id: true; email: true; firstName: true; lastName: true };
        };
        _count: { select: { adminUsers: true } };
      };
    }>;

    const updated = (await this.prisma.client.role.update({
      where: { id },
      data: updateData,

      include: {
        permissions: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        lastUpdatedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
    })) as unknown as RoleWithIncludes;

    return this.formatRoleResponse(updated);
  }

  async remove(id: number) {
    const role = await this.prisma.client.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Check if role is assigned to any admins
    if (role._count.adminUsers > 0) {
      throw new BadRequestException(
        `Cannot delete role: it is assigned to ${role._count.adminUsers} admin user(s). Please reassign or remove admins first.`,
      );
    }

    await this.prisma.client.role.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Format role response with permissions
   * Accepts role with various include combinations
   */
  private formatRoleResponse(role: {
    id: number;
    title: string;
    description: string | null;
    status: RoleStatus;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{ isActive: boolean; permission: string }>;
    createdBy: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
    } | null;
    lastUpdatedBy?: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
    } | null;
    _count?: { adminUsers?: number };
  }) {
    // Only return permissions that are active (all should be, but filter for safety)
    const permissions = role.permissions
      .filter((p) => p.isActive)
      .map((p) => p.permission);

    return {
      id: role.id,
      title: role.title,
      description: role.description,
      status: role.status,
      permissions, // Only granted permissions
      createdBy: role.createdBy
        ? {
            id: role.createdBy.id,
            email: role.createdBy.email,
            name: `${role.createdBy.firstName} ${role.createdBy.lastName}`,
          }
        : null,
      lastUpdatedBy: role.lastUpdatedBy
        ? {
            id: role.lastUpdatedBy.id,
            email: role.lastUpdatedBy.email,
            name: `${role.lastUpdatedBy.firstName} ${role.lastUpdatedBy.lastName}`,
          }
        : null,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      adminCount: role._count?.adminUsers || 0,
    };
  }
}

