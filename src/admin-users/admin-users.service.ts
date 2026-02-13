import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';
import { MailService } from '../mail/mail.service';
import { AdminStatus, RoleStatus, Prisma } from '@prisma/client';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AdminAuditService } from './admin-audit.service';

// Type for admin user with department relation
type AdminWithDepartment = Prisma.AdminUserGetPayload<{
  include: { department: true };
}>;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly audit: AdminAuditService,
  ) {}

  async createAdmin(dto: CreateAdminUserDto) {
    // If roleId is provided, verify it exists and is ACTIVE
    if (dto.roleId) {
      const role = await this.prisma.client.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${dto.roleId} not found`);
      }
      if (role.status !== RoleStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot assign inactive role. The role "${role.title}" is ${role.status}. Only ACTIVE roles can be assigned to admin users.`,
        );
      }
    }

    // If departmentId is provided, verify it exists
    if (dto.departmentId) {
      const department = await this.prisma.client.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department) {
        throw new BadRequestException(
          `Department with ID ${dto.departmentId} not found`,
        );
      }
    }

    let admin: AdminWithDepartment;
    try {
      admin = await this.prisma.client.adminUser.create({
        data: {
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          departmentId: dto.departmentId,
          role: dto.role, // Legacy role enum
          roleId: dto.roleId, // Dynamic role (takes precedence)
          status: AdminStatus.ACTIVE,
          // placeholder password until they set one
          password: 'TEMP_PASSWORD_PLACEHOLDER',
          passwordSet: false,
        },
        include: {
          department: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Admin with this email already exists');
      }
      throw err;
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      purpose: 'password_setup' as const,
      type: 'admin' as const,
    };
    const options: JwtSignOptions = {
      expiresIn: (process.env.ADMIN_PASSWORD_SETUP_TTL ?? '24h') as
        | number
        | StringValue,
    };
    const token = await this.jwtService.signAsync(payload, options);

    await this.mailService.sendAdminPasswordSetupLink(
      admin.email,
      token,
      admin.firstName,
    );

    // Fetch role info if roleId was assigned
    let roleInfo: { id: number; title: string; status: string } | null = null;
    if (admin.roleId) {
      const role = await this.prisma.client.role.findUnique({
        where: { id: admin.roleId },
        select: {
          id: true,
          title: true,
          status: true,
        },
      });
      if (role) {
        roleInfo = role;
      }
    }

    await this.audit.log('ADMIN_CREATED', admin.id, undefined, {
      email: admin.email,
      role: admin.role,
      roleId: admin.roleId,
      departmentId: admin.departmentId,
    });

    const department = admin.department;

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      departmentId: admin.departmentId,
      department: department
        ? {
            id: department.id,
            name: department.name,
            description: department.description,
          }
        : null,
      role: admin.role, // Legacy role enum (for backward compatibility)
      roleId: admin.roleId || null, // Dynamic role ID
      dynamicRole: roleInfo, // Dynamic role details if assigned
      status: admin.status,
      createdAt: admin.createdAt,
    };
  }

  async resendInvite(id: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE || admin.passwordSet) {
      throw new Error('Cannot resend invite for this admin');
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      purpose: 'password_setup' as const,
      type: 'admin' as const,
    };
    const options: JwtSignOptions = {
      expiresIn: (process.env.ADMIN_PASSWORD_SETUP_TTL ?? '24h') as
        | number
        | StringValue,
    };
    const token = await this.jwtService.signAsync(payload, options);

    await this.mailService.sendAdminPasswordSetupLink(
      admin.email,
      token,
      admin.firstName,
    );

    await this.audit.log('ADMIN_INVITE_RESENT', admin.id, undefined, {
      email: admin.email,
    });

    return { success: true };
  }

  async findAll(query: GetAdminUsersQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      role,
      roleId,
      departmentId,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AdminUserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    const [admins, total] = await Promise.all([
      this.prisma.client.adminUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          dynamicRole: {
            include: {
              permissions: true,
            },
          },
        },
      }),
      this.prisma.client.adminUser.count({ where }),
    ]);

    return {
      admins: admins.map((admin) => ({
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        status: admin.status,
        role: admin.role,
        roleId: admin.roleId,
        dynamicRole: admin.dynamicRole
          ? {
              id: admin.dynamicRole.id,
              title: admin.dynamicRole.title,
              status: admin.dynamicRole.status,
              permissions: admin.dynamicRole.permissions.map(
                (rp) => rp.permission,
              ),
            }
          : null,
        departmentId: admin.departmentId,
        department: admin.department
          ? {
              id: admin.department.id,
              name: admin.department.name,
            }
          : null,
        passwordSet: admin.passwordSet,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id },
      include: {
        department: true,
        dynamicRole: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      status: admin.status,
      role: admin.role,
      roleId: admin.roleId,
      dynamicRole: admin.dynamicRole
        ? {
            id: admin.dynamicRole.id,
            title: admin.dynamicRole.title,
            status: admin.dynamicRole.status,
            permissions: admin.dynamicRole.permissions.map(
              (rp) => rp.permission,
            ),
          }
        : null,
      departmentId: admin.departmentId,
      department: admin.department
        ? {
            id: admin.department.id,
            name: admin.department.name,
            description: admin.department.description,
          }
        : null,
      passwordSet: admin.passwordSet,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  async update(id: number, dto: UpdateAdminUserDto, actorId: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    // If roleId is provided, verify it exists and is ACTIVE
    if (dto.roleId) {
      const role = await this.prisma.client.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${dto.roleId} not found`);
      }
      if (role.status !== RoleStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot assign inactive role. The role "${role.title}" is ${role.status}.`,
        );
      }
    }

    // If departmentId is provided (and not null), verify it exists
    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      const department = await this.prisma.client.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department) {
        throw new BadRequestException(
          `Department with ID ${dto.departmentId} not found`,
        );
      }
    }

    const updateData: Prisma.AdminUserUpdateInput = {};

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.roleId !== undefined) {
      updateData.dynamicRole = dto.roleId
        ? { connect: { id: dto.roleId } }
        : { disconnect: true };
    }
    if (dto.departmentId !== undefined) {
      updateData.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.client.adminUser.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        dynamicRole: {
          include: {
            permissions: true,
          },
        },
      },
    });

    await this.audit.log('ADMIN_UPDATED', actorId, id, {
      changes: dto,
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      status: updated.status,
      role: updated.role,
      roleId: updated.roleId,
      dynamicRole: updated.dynamicRole
        ? {
            id: updated.dynamicRole.id,
            title: updated.dynamicRole.title,
            status: updated.dynamicRole.status,
            permissions: updated.dynamicRole.permissions.map(
              (rp) => rp.permission,
            ),
          }
        : null,
      departmentId: updated.departmentId,
      department: updated.department
        ? {
            id: updated.department.id,
            name: updated.department.name,
          }
        : null,
      passwordSet: updated.passwordSet,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deactivate(id: number, actorId: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    if (admin.status === AdminStatus.INACTIVE) {
      throw new BadRequestException('Admin user is already deactivated');
    }

    // Prevent self-deactivation
    if (admin.id === actorId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const updated = await this.prisma.client.adminUser.update({
      where: { id },
      data: { status: AdminStatus.INACTIVE },
    });

    await this.audit.log('ADMIN_DEACTIVATED', actorId, id, {
      email: admin.email,
    });

    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      message: 'Admin user has been deactivated',
    };
  }

  async reactivate(id: number, actorId: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    if (admin.status === AdminStatus.ACTIVE) {
      throw new BadRequestException('Admin user is already active');
    }

    const updated = await this.prisma.client.adminUser.update({
      where: { id },
      data: { status: AdminStatus.ACTIVE },
    });

    await this.audit.log('ADMIN_REACTIVATED', actorId, id, {
      email: admin.email,
    });

    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      message: 'Admin user has been reactivated',
    };
  }
}
