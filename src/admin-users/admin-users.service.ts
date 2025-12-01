import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { MailService } from '../mail/mail.service';
import { AdminStatus } from '@prisma/client';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AdminAuditService } from './admin-audit.service';
import { ConflictException } from '@nestjs/common';
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
    let admin;
    try {
      admin = await this.prisma.client.adminUser.create({
        data: {
          email: dto.email.toLowerCase(),
          firstName: dto.firstName,
          lastName: dto.lastName,
          department: dto.department,
          role: dto.role,
          status: AdminStatus.ACTIVE,
          // placeholder password until they set one
          password: 'TEMP_PASSWORD_PLACEHOLDER',
          passwordSet: false,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
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
      // cast to any to satisfy typings; jsonwebtoken accepts string or number
      expiresIn: (process.env.ADMIN_PASSWORD_SETUP_TTL ?? '24h') as any,
    };
    const token = await this.jwtService.signAsync(payload, options);

    await this.mailService.sendAdminPasswordSetupLink(
      admin.email,
      token,
      admin.firstName,
    );

    await this.audit.log('ADMIN_CREATED', admin.id, undefined, {
      email: admin.email,
      role: admin.role,
      department: admin.department,
    });

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      department: admin.department,
      role: admin.role,
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
      expiresIn: (process.env.ADMIN_PASSWORD_SETUP_TTL ?? '24h') as any,
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


