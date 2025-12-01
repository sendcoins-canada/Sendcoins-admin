import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AdminStatus } from '@prisma/client';
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

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        status: admin.status,
      },
    };
  }

  async validatePasswordToken(dto: ValidatePasswordTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload & {
        purpose?: string;
        type?: string;
      }>(dto.token);

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
        // explicitly set passwordSet via field update to satisfy typings
        passwordSet: true as any,
        lastPasswordChangeAt: new Date(),
      } as any,
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
        expiresIn: (process.env.ADMIN_PASSWORD_RESET_TTL ?? '1h') as any,
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
        passwordSet: true as any,
        lastPasswordChangeAt: new Date(),
      } as any,
    });

    await this.audit.log('ADMIN_PASSWORD_CHANGED', updated.id, {
      email: updated.email,
    });

    return { success: true };
  }
}


