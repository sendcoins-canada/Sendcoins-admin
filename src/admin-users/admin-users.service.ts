import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { MailService } from '../mail/mail.service';
import { AdminStatus, RoleStatus } from '@prisma/client';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AdminAuditService } from './admin-audit.service';
import { Prisma } from '@prisma/client';

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

    // Using a loosely-typed admin object here to avoid tight coupling
    // to Prisma's generated helper types, which can change between versions.
    let admin: any;
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

    // Type guard for department
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
}
