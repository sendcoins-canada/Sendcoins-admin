import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AdminStatus, Prisma } from '@prisma/client';
import type { StringValue } from 'ms';
import { ValidatePasswordTokenDto } from './dto/validate-password-token.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './jwt.strategy';
import { MailService } from '../mail/mail.service';
import { AdminAuthAuditService } from './admin-audit.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async validateAdmin(email: string, password: string) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return admin;
  }

  async login(email: string, password: string) {
    const admin = await this.validateAdmin(email, password);

    // Update last login timestamp

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Fetch full admin details with role and department
    // Define the type first to help TypeScript inference
    type AdminWithRelations = Prisma.AdminUserGetPayload<{
      include: {
        dynamicRole: {
          include: {
            permissions: true;
          };
        };
        department: true;
      };
    }>;

    // Use type assertion to work around IDE TypeScript server cache issues
    // The Prisma types are correct, but IDE may show errors due to stale type cache
    // This is safe because the query structure matches the type definition

    const adminWithDetailsRaw = (await this.prisma.client.adminUser.findUnique({
      where: { id: admin.id },

      include: {
        dynamicRole: {
          include: {
            permissions: true,
          },
        },
        department: true,
      },
    })) as unknown as AdminWithRelations | null;

    if (!adminWithDetailsRaw) {
      throw new UnauthorizedException('Admin user not found');
    }

    const adminWithDetails = adminWithDetailsRaw;

    // Type-safe access to relations
    const department = adminWithDetails.department;
    const dynamicRole = adminWithDetails.dynamicRole;

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      admin: {
        id: adminWithDetails.id,
        email: adminWithDetails.email,
        firstName: adminWithDetails.firstName,
        lastName: adminWithDetails.lastName,

        profile: adminWithDetails.profile ?? null,
        role: adminWithDetails.role, // Legacy role

        roleId: adminWithDetails.roleId ?? null,

        dynamicRole: dynamicRole
          ? {
              id: dynamicRole.id,

              title: dynamicRole.title,

              status: dynamicRole.status,

              permissions: dynamicRole.permissions
                .filter((p: { isActive: boolean }) => p.isActive)
                .map((p: { permission: string }) => p.permission),
            }
          : null,

        departmentId: adminWithDetails.departmentId ?? null,

        department: department
          ? {
              id: department.id,

              name: department.name,

              description: department.description ?? null,
            }
          : null,

        lastLoginAt: adminWithDetails.lastLoginAt ?? null,
        status: adminWithDetails.status,
      },
    };
  }

  async validatePasswordToken(dto: ValidatePasswordTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<
        JwtPayload & {
          purpose?: string;
          type?: string;
        }
      >(dto.token);

      if (payload.type !== 'admin') {
        throw new UnauthorizedException('Invalid token type');
      }

      if (
        payload.purpose !== 'password_setup' &&
        payload.purpose !== 'password_reset'
      ) {
        throw new UnauthorizedException('Invalid token purpose');
      }

      const admin = await this.prisma.client.adminUser.findUnique({
        where: { id: payload.sub },
      });

      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        valid: true,
        email: admin.email,
        purpose: payload.purpose,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async setPassword(dto: SetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    let payload: JwtPayload & { purpose?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Invalid token type');
    }

    if (
      payload.purpose !== 'password_setup' &&
      payload.purpose !== 'password_reset'
    ) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updated = await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        password: passwordHash,

        passwordSet: true,
        lastPasswordChangeAt: new Date(),
      },
    });

    await this.audit.log('ADMIN_PASSWORD_SET', updated.id, {
      purpose: payload.purpose,
      email: updated.email,
    });

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { email },
    });

    if (admin && admin.status === AdminStatus.ACTIVE) {
      const payload = {
        sub: admin.id,
        email: admin.email,
        purpose: 'password_reset' as const,
        type: 'admin' as const,
      };
      const options: JwtSignOptions = {
        expiresIn: (process.env.ADMIN_PASSWORD_RESET_TTL ?? '1h') as
          | number
          | StringValue,
      };
      const token = await this.jwtService.signAsync(payload, options);

      await this.mailService.sendAdminPasswordResetLink(
        admin.email,
        token,
        admin.firstName,
      );

      await this.audit.log('ADMIN_PASSWORD_RESET_REQUESTED', admin.id, {
        email: admin.email,
      });
    }

    return { success: true };
  }

  async changePassword(adminId: number, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      admin.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updated = await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        password: passwordHash,

        passwordSet: true,
        lastPasswordChangeAt: new Date(),
      },
    });

    await this.audit.log('ADMIN_PASSWORD_CHANGED', updated.id, {
      email: updated.email,
    });

    return { success: true };
  }
}
