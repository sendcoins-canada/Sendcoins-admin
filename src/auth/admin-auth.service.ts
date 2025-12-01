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
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { UpdateIpAllowlistDto } from './dto/update-ip-allowlist.dto';
import { JwtPayload } from './jwt.strategy';
import { MailService } from '../mail/mail.service';
import { AdminAuthAuditService } from './admin-audit.service';
import { MfaService } from './mfa.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly audit: AdminAuthAuditService,
    private readonly mfaService: MfaService,
  ) {}

  /**
   * Check if IP is allowed for admin
   */
  private checkIpAllowlist(admin: any, clientIp: string): boolean {
    if (!admin.allowedIps || !Array.isArray(admin.allowedIps)) {
      return true; // No IP restriction
    }
    return admin.allowedIps.includes(clientIp);
  }

  async validateAdmin(email: string, password: string, clientIp?: string) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check IP allowlist if configured
    if (clientIp && !this.checkIpAllowlist(admin, clientIp)) {
      throw new UnauthorizedException('Access denied from this IP address');
    }

    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return admin;
  }

  async login(email: string, password: string, clientIp?: string) {
    const admin = await this.validateAdmin(email, password, clientIp);

    // If MFA is enabled, return temporary token for MFA verification
    if ((admin as any).mfaEnabled && (admin as any).mfaSecret) {
      const tempPayload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        purpose: 'mfa_verification' as const,
        type: 'admin' as const,
      };
      const tempToken = await this.jwtService.signAsync(tempPayload, {
        expiresIn: '5m' as any, // Short-lived token
      });

      return {
        requiresMfa: true,
        tempToken,
        message: 'Please enter your 6-digit authentication code from your authenticator app',
      };
    }

    // No MFA, return full access token
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.audit.log('ADMIN_LOGIN', admin.id, {
      email: admin.email,
      mfaUsed: false,
    });

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

  async verifyMfa(dto: VerifyMfaDto) {
    let payload: JwtPayload & { purpose?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.purpose !== 'mfa_verification' || payload.type !== 'admin') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const adminWithMfa = admin as any;

    if (!adminWithMfa.mfaEnabled || !adminWithMfa.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Try TOTP code first
    const totpValid = this.mfaService.verifyToken(
      adminWithMfa.mfaSecret,
      dto.code,
    );

    let backupCodeUsed = false;
    let updatedBackupCodes = adminWithMfa.mfaBackupCodes as string[] | null;

    // If TOTP fails, try backup codes
    if (!totpValid && adminWithMfa.mfaBackupCodes) {
      const backupCodes = adminWithMfa.mfaBackupCodes as string[];
      for (let i = 0; i < backupCodes.length; i++) {
        const isValid = await this.mfaService.verifyBackupCode(dto.code, [
          backupCodes[i],
        ]);
        if (isValid) {
          backupCodeUsed = true;
          // Remove used backup code
          updatedBackupCodes = this.mfaService.removeBackupCode(
            backupCodes,
            backupCodes[i],
          );
          break;
        }
      }
    }

    if (!totpValid && !backupCodeUsed) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Update lastMfaAt and backup codes if used
    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        lastMfaAt: new Date(),
        mfaBackupCodes: updatedBackupCodes as any,
      } as any,
    });

    // Generate final access token
    const finalPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };
    const accessToken = await this.jwtService.signAsync(finalPayload);

    await this.audit.log('ADMIN_LOGIN', admin.id, {
      email: admin.email,
      mfaUsed: true,
      backupCodeUsed,
    });

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

  /**
   * Start MFA setup - generate secret and QR code
   */
  async startMfaSetup(adminId: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    if ((admin as any).mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const { secret, otpauthUrl } = this.mfaService.generateSecret(
      admin.email,
      process.env.MFA_ISSUER_NAME || 'SendCoins Admin',
    );
    const qrCode = await this.mfaService.generateQRCode(otpauthUrl);

    // Store secret temporarily (will be confirmed in enableMfa)
    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaSecret: secret,
      } as any,
    });

    return {
      secret,
      qrCode,
      manualEntryKey: secret,
    };
  }

  /**
   * Complete MFA setup by verifying the code
   */
  async enableMfa(adminId: number, dto: EnableMfaDto) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const adminWithMfa2 = admin as any;

    if (!adminWithMfa2.mfaSecret) {
      throw new BadRequestException(
        'MFA setup not started. Call start-mfa-setup first.',
      );
    }

    const isValid = this.mfaService.verifyToken(
      adminWithMfa2.mfaSecret,
      dto.code,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Generate backup codes
    const { codes, hashedCodes } =
      await this.mfaService.generateBackupCodes(10);

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaEnabled: true as any,
        mfaBackupCodes: hashedCodes as any,
      } as any,
    });

    await this.audit.log('ADMIN_MFA_ENABLED', admin.id, {
      email: admin.email,
    });

    return {
      success: true,
      backupCodes: codes, // Return plain codes once - user must save them
    };
  }

  /**
   * Disable MFA for an admin
   */
  async disableMfa(adminId: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const adminWithMfa3 = admin as any;

    if (!adminWithMfa3.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaEnabled: false as any,
        mfaSecret: null,
        mfaBackupCodes: null,
        lastMfaAt: null,
      } as any,
    });

    await this.audit.log('ADMIN_MFA_DISABLED', admin.id, {
      email: admin.email,
    });

    return { success: true };
  }

  /**
   * Generate new backup codes
   */
  async generateBackupCodes(adminId: number) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const adminWithMfa4 = admin as any;

    if (!adminWithMfa4.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const { codes, hashedCodes } =
      await this.mfaService.generateBackupCodes(10);

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaBackupCodes: hashedCodes as any,
      } as any,
    });

    await this.audit.log('ADMIN_MFA_BACKUP_CODES_GENERATED', admin.id, {
      email: admin.email,
    });

    return {
      backupCodes: codes, // Return plain codes once
    };
  }

  /**
   * Update IP allowlist for an admin
   */
  async updateIpAllowlist(adminId: number, dto: UpdateIpAllowlistDto) {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const ips = dto.ips || [];

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        allowedIps: ips as any,
      } as any,
    });

    await this.audit.log('ADMIN_IP_ALLOWLIST_UPDATED', admin.id, {
      email: admin.email,
      ipCount: ips.length,
    });

    return {
      success: true,
      allowedIps: ips,
    };
  }
}
