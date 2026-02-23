import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AdminStatus, Prisma } from '@prisma/client';
import type { StringValue } from 'ms';
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

// Refresh token configuration
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token when using refresh tokens

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

// Extended admin type with MFA fields
interface AdminWithMfa {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  status: AdminStatus;
  role: string;
  mfaEnabled?: boolean;
  mfaSecret?: string | null;
  mfaBackupCodes?: string[] | null;
  allowedIps?: string[] | null;
}

// Type for refresh token operations (exported for controller return types)
export interface RefreshTokenRecord {
  id: number;
  adminId: number;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  createdAt: Date;
  admin?: {
    id: number;
    email: string;
    role: string;
    status: AdminStatus;
    deletedAt?: Date | null;
  };
}

// Type for PrismaClient with adminRefreshToken
interface PrismaClientWithRefreshToken {
  adminRefreshToken: {
    create: (args: {
      data: {
        adminId: number;
        token: string;
        expiresAt: Date;
        ipAddress?: string;
        deviceInfo?: string;
      };
    }) => Promise<RefreshTokenRecord>;
    findUnique: (args: {
      where: { token: string };
      include?: { admin: boolean };
    }) => Promise<RefreshTokenRecord | null>;
    findMany: (args: {
      where: {
        adminId: number;
        isRevoked?: boolean;
        expiresAt?: { gt: Date };
      };
      orderBy?: { createdAt: 'desc' | 'asc' };
      select?: {
        id?: boolean;
        deviceInfo?: boolean;
        ipAddress?: boolean;
        createdAt?: boolean;
        expiresAt?: boolean;
      };
    }) => Promise<RefreshTokenRecord[]>;
    update: (args: {
      where: { id: number };
      data: { isRevoked: boolean };
    }) => Promise<RefreshTokenRecord>;
    updateMany: (args: {
      where: { adminId?: number; id?: { in: number[] }; isRevoked?: boolean };
      data: { isRevoked: boolean };
    }) => Promise<{ count: number }>;
  };
}

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
   * Get typed client for refresh token operations
   */
  private get refreshTokenClient(): PrismaClientWithRefreshToken {
    return this.prisma.client as unknown as PrismaClientWithRefreshToken;
  }

  private async getAdminWithRelations(
    adminId: number,
  ): Promise<AdminWithRelations> {
    const adminWithDetailsRaw = (await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
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

    return adminWithDetailsRaw;
  }

  private buildAdminResponse(adminWithDetails: AdminWithRelations) {
    const department = adminWithDetails.department;
    const dynamicRole = adminWithDetails.dynamicRole;
    // Cast to access MFA fields
    const adminMfa = adminWithDetails as unknown as AdminWithMfa;

    return {
      id: adminWithDetails.id,
      email: adminWithDetails.email,
      firstName: adminWithDetails.firstName,
      lastName: adminWithDetails.lastName,
      profile: adminWithDetails.profile ?? null,
      role: adminWithDetails.role,
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
      mfaEnabled: adminMfa.mfaEnabled ?? false,
    };
  }

  /**
   * Check if IP is allowed for admin
   */
  private checkIpAllowlist(
    admin: { allowedIps?: string[] | null },
    clientIp: string,
  ): boolean {
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
    const adminWithIp = admin as typeof admin & {
      allowedIps?: string[] | null;
    };
    if (clientIp && !this.checkIpAllowlist(adminWithIp, clientIp)) {
      throw new UnauthorizedException('Access denied from this IP address');
    }

    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return admin;
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

    const adminWithMfaFields = admin as unknown as AdminWithMfa;
    if (adminWithMfaFields.mfaEnabled) {
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
      } as Prisma.AdminUserUpdateInput,
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

    const adminMfa = admin as unknown as AdminWithMfa;

    if (!adminMfa.mfaSecret) {
      throw new BadRequestException(
        'MFA setup not started. Call start-mfa-setup first.',
      );
    }

    const isValid = this.mfaService.verifyToken(adminMfa.mfaSecret, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Generate backup codes
    const { codes, hashedCodes } =
      await this.mfaService.generateBackupCodes(10);

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: hashedCodes,
      } as Prisma.AdminUserUpdateInput,
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

    const adminMfaDisable = admin as unknown as AdminWithMfa;

    if (!adminMfaDisable.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: Prisma.JsonNull,
        lastMfaAt: null,
      },
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

    const adminMfaBackup = admin as unknown as AdminWithMfa;

    if (!adminMfaBackup.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const { codes, hashedCodes } =
      await this.mfaService.generateBackupCodes(10);

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        mfaBackupCodes: hashedCodes,
      } as Prisma.AdminUserUpdateInput,
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
        allowedIps: ips,
      } as Prisma.AdminUserUpdateInput,
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

  /**
   * Generate a secure refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create and store a refresh token for an admin
   */
  private async createRefreshToken(
    adminId: number,
    clientIp?: string,
    userAgent?: string,
  ): Promise<string> {
    const refreshToken = this.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Hash the token before storing (for security)
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.refreshTokenClient.adminRefreshToken.create({
      data: {
        adminId,
        token: hashedToken,
        expiresAt,
        ipAddress: clientIp,
        deviceInfo: userAgent?.substring(0, 500), // Truncate if too long
      },
    });

    // Clean up old/expired tokens for this admin (keep last 5 active sessions)
    const existingTokens =
      await this.refreshTokenClient.adminRefreshToken.findMany({
        where: {
          adminId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

    if (existingTokens.length > 5) {
      const tokensToRevoke = existingTokens.slice(5);
      await this.refreshTokenClient.adminRefreshToken.updateMany({
        where: {
          id: { in: tokensToRevoke.map((t) => t.id) },
        },
        data: { isRevoked: true },
      });
    }

    return refreshToken;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientIp?: string,
    userAgent?: string,
  ) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken =
      await this.refreshTokenClient.adminRefreshToken.findUnique({
        where: { token: hashedToken },
        include: { admin: true },
      });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      // Potential token reuse attack - revoke all tokens for this admin
      await this.refreshTokenClient.adminRefreshToken.updateMany({
        where: { adminId: storedToken.adminId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException(
        'Refresh token has been revoked. Please login again.',
      );
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const admin = storedToken.admin;
    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Check if admin was deleted (soft delete)
    if (admin.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
    }

    // Revoke current refresh token and issue new one (rotation)
    await this.refreshTokenClient.adminRefreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Generate new tokens
    const newRefreshToken = await this.createRefreshToken(
      admin.id,
      clientIp,
      userAgent,
    );

    const adminWithDetails = await this.getAdminWithRelations(admin.id);

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      admin: this.buildAdminResponse(adminWithDetails),
    };
  }

  /**
   * Revoke a specific refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken =
      await this.refreshTokenClient.adminRefreshToken.findUnique({
        where: { token: hashedToken },
      });

    if (storedToken && !storedToken.isRevoked) {
      await this.refreshTokenClient.adminRefreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });
    }

    return { success: true };
  }

  /**
   * Revoke all refresh tokens for an admin (logout from all devices)
   */
  async revokeAllRefreshTokens(adminId: number) {
    await this.refreshTokenClient.adminRefreshToken.updateMany({
      where: { adminId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.audit.log('ADMIN_LOGOUT_ALL_DEVICES', adminId, {});

    return { success: true };
  }

  /**
   * Get active sessions for an admin
   */
  async getActiveSessions(adminId: number) {
    const sessions = await this.refreshTokenClient.adminRefreshToken.findMany({
      where: {
        adminId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { sessions };
  }

  /**
   * Get current admin profile
   */
  async getCurrentAdminProfile(adminId: number) {
    const adminWithDetails = await this.getAdminWithRelations(adminId);
    return this.buildAdminResponse(adminWithDetails);
  }

  /**
   * Login with refresh token support
   */
  async loginWithRefreshToken(
    email: string,
    password: string,
    clientIp?: string,
    userAgent?: string,
  ) {
    const admin = await this.validateAdmin(email, password, clientIp);

    // If MFA is enabled, return temporary token for MFA verification
    const adminMfaCheck = admin as unknown as AdminWithMfa;
    if (adminMfaCheck.mfaEnabled && adminMfaCheck.mfaSecret) {
      const tempPayload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        purpose: 'mfa_verification' as const,
        type: 'admin' as const,
      };
      const tempToken = await this.jwtService.signAsync(tempPayload, {
        expiresIn: '5m',
      });

      return {
        requiresMfa: true,
        tempToken,
        message:
          'Please enter your 6-digit authentication code from your authenticator app',
      };
    }

    // No MFA - proceed with login
    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const adminWithDetails = await this.getAdminWithRelations(admin.id);

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = await this.createRefreshToken(
      admin.id,
      clientIp,
      userAgent,
    );

    await this.audit.log('ADMIN_LOGIN', admin.id, {
      email: admin.email,
      mfaUsed: false,
      ipAddress: clientIp,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      admin: this.buildAdminResponse(adminWithDetails),
    };
  }

  /**
   * Verify MFA for a sensitive action (user is already logged in)
   * Returns a short-lived action token that can be used to authorize the action
   */
  async verifyActionMfa(
    adminId: number,
    code: string,
    action?: string,
  ): Promise<{ success: boolean; actionToken: string; expiresIn: number }> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const adminMfa = admin as unknown as AdminWithMfa;

    if (!adminMfa.mfaEnabled || !adminMfa.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Verify TOTP or backup code
    const totpValid = this.mfaService.verifyToken(adminMfa.mfaSecret, code);

    let backupCodeUsed = false;
    let updatedBackupCodes = adminMfa.mfaBackupCodes ?? null;

    if (!totpValid && adminMfa.mfaBackupCodes) {
      const backupCodes = adminMfa.mfaBackupCodes;
      for (let i = 0; i < backupCodes.length; i++) {
        const isValid = await this.mfaService.verifyBackupCode(code, [
          backupCodes[i],
        ]);
        if (isValid) {
          backupCodeUsed = true;
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

    // Update backup codes if one was used
    if (backupCodeUsed) {
      await this.prisma.client.adminUser.update({
        where: { id: admin.id },
        data: {
          mfaBackupCodes: updatedBackupCodes,
        } as Prisma.AdminUserUpdateInput,
      });
    }

    // Generate a short-lived action token (5 minutes)
    const actionToken = await this.jwtService.signAsync(
      {
        sub: admin.id,
        purpose: 'action_mfa_verified',
        action: action || 'SENSITIVE_ACTION',
        verifiedAt: Date.now(),
      },
      { expiresIn: '5m' } as JwtSignOptions,
    );

    // Log the MFA verification for action
    await this.audit.log('ACTION_MFA_VERIFIED', admin.id, {
      action: action || 'SENSITIVE_ACTION',
      backupCodeUsed,
    });

    return {
      success: true,
      actionToken,
      expiresIn: 300, // 5 minutes in seconds
    };
  }

  /**
   * Check if an action token is valid
   */
  async validateActionToken(
    token: string,
    adminId: number,
  ): Promise<{ valid: boolean; action?: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (
        payload.purpose !== 'action_mfa_verified' ||
        payload.sub !== adminId
      ) {
        return { valid: false };
      }

      return {
        valid: true,
        action: payload.action,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Check if admin has MFA enabled
   */
  async checkMfaStatus(adminId: number): Promise<{
    mfaEnabled: boolean;
    mfaRequired: boolean;
  }> {
    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid user');
    }

    const adminMfa = admin as unknown as AdminWithMfa;

    return {
      mfaEnabled: adminMfa.mfaEnabled ?? false,
      mfaRequired: adminMfa.mfaEnabled ?? false, // For now, required if enabled
    };
  }

  /**
   * Verify MFA and return tokens with refresh token
   */
  async verifyMfaWithRefreshToken(
    dto: VerifyMfaDto,
    clientIp?: string,
    userAgent?: string,
  ) {
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

    const adminMfaVerify = admin as unknown as AdminWithMfa;

    if (!adminMfaVerify.mfaEnabled || !adminMfaVerify.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Verify TOTP or backup code
    const totpValid = this.mfaService.verifyToken(
      adminMfaVerify.mfaSecret,
      dto.code,
    );

    let backupCodeUsed = false;
    let updatedBackupCodes = adminMfaVerify.mfaBackupCodes ?? null;

    if (!totpValid && adminMfaVerify.mfaBackupCodes) {
      const backupCodes = adminMfaVerify.mfaBackupCodes;
      for (let i = 0; i < backupCodes.length; i++) {
        const isValid = await this.mfaService.verifyBackupCode(dto.code, [
          backupCodes[i],
        ]);
        if (isValid) {
          backupCodeUsed = true;
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

    // Update admin
    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: {
        lastMfaAt: new Date(),
        lastLoginAt: new Date(),
        mfaBackupCodes: updatedBackupCodes,
      } as Prisma.AdminUserUpdateInput,
    });

    const adminWithDetails = await this.getAdminWithRelations(admin.id);

    const finalPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const accessToken = await this.jwtService.signAsync(finalPayload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = await this.createRefreshToken(
      admin.id,
      clientIp,
      userAgent,
    );

    await this.audit.log('ADMIN_LOGIN', admin.id, {
      email: admin.email,
      mfaUsed: true,
      backupCodeUsed,
      ipAddress: clientIp,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      admin: this.buildAdminResponse(adminWithDetails),
    };
  }
}
