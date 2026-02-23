import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  Ip,
  Headers,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ValidatePasswordTokenDto } from './dto/validate-password-token.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { UpdateIpAllowlistDto } from './dto/update-ip-allowlist.dto';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { VerifyActionMfaDto } from './dto/verify-action-mfa.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';

// Authenticated request type
interface AuthenticatedRequest extends Request {
  user: { id: number; email: string; role: string };
}

@ApiTags('AdminAuth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate an admin user. Returns access token (15min) and refresh token (7 days). If MFA is enabled, returns a temporary token for MFA verification.',
  })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'string' },
        admin: { type: 'object' },
      },
    },
  })
  login(
    @Body() dto: AdminLoginDto,
    @Ip() clientIp: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.adminAuthService.loginWithRefreshToken(
      dto.email,
      dto.password,
      clientIp,
      userAgent,
    );
  }

  @Post('verify-mfa')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Verify MFA code',
    description:
      'Complete login by verifying MFA code (TOTP or backup code) using temporary token from login.',
  })
  @ApiBody({ type: VerifyMfaDto })
  verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Ip() clientIp: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.adminAuthService.verifyMfaWithRefreshToken(
      dto,
      clientIp,
      userAgent,
    );
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchange a valid refresh token for a new access token and refresh token (token rotation).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'string' },
        admin: { type: 'object' },
      },
    },
  })
  refreshToken(
    @Body() dto: RefreshTokenDto,
    @Ip() clientIp: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.adminAuthService.refreshAccessToken(
      dto.refreshToken,
      clientIp,
      userAgent,
    );
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout (revoke refresh token)',
    description: 'Revokes the provided refresh token, ending that session.',
  })
  @ApiBody({ type: LogoutDto })
  logout(@Body() dto: LogoutDto) {
    return this.adminAuthService.revokeRefreshToken(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description:
      'Revokes all refresh tokens for the current admin, ending all sessions.',
  })
  logoutAll(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.revokeAllRefreshTokens(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current admin profile',
    description:
      'Returns the profile information of the currently authenticated admin user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin profile information',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        profile: { type: 'string', nullable: true },
        role: { type: 'string' },
        roleId: { type: 'number', nullable: true },
        dynamicRole: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            status: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
        departmentId: { type: 'number', nullable: true },
        department: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        status: { type: 'string' },
      },
    },
  })
  getCurrentProfile(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.getCurrentAdminProfile(req.user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active sessions',
    description: 'Returns a list of all active sessions for the current admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active sessions list',
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              deviceInfo: { type: 'string' },
              ipAddress: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  getActiveSessions(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.getActiveSessions(req.user.id);
  }

  @Post('validate-password-token')
  @ApiOperation({
    summary: 'Validate password token',
    description:
      'Validate a password setup/reset token before showing the password form.',
  })
  @ApiBody({ type: ValidatePasswordTokenDto })
  validatePasswordToken(@Body() dto: ValidatePasswordTokenDto) {
    return this.adminAuthService.validatePasswordToken(dto);
  }

  @Post('set-password')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Set or reset password using token',
    description:
      'Set a new password using a valid password setup/reset token from email.',
  })
  @ApiBody({ type: SetPasswordDto })
  setPassword(@Body() dto: SetPasswordDto) {
    return this.adminAuthService.setPassword(dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Send a password reset link to the admin email if the account exists.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.adminAuthService.forgotPassword(dto);
  }

  @Post('change-password')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password',
    description:
      'Change password for the currently authenticated admin using current password.',
  })
  @ApiBody({ type: ChangePasswordDto })
  changePassword(
    @Req()
    req: {
      user?: { id: number };
    },
    @Body() dto: ChangePasswordDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.adminAuthService.changePassword(req.user.id, dto);
  }

  @Post('mfa/start-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start MFA setup',
    description:
      'Generate MFA secret and QR code. Call enable-mfa to complete setup.',
  })
  startMfaSetup(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.startMfaSetup(req.user.id);
  }

  @Post('mfa/enable')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enable MFA',
    description:
      'Complete MFA setup by verifying a TOTP code. Returns backup codes (save them!).',
  })
  @ApiBody({ type: EnableMfaDto })
  enableMfa(@Req() req: AuthenticatedRequest, @Body() dto: EnableMfaDto) {
    return this.adminAuthService.enableMfa(req.user.id, dto);
  }

  @Post('mfa/disable')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable MFA',
    description: 'Disable MFA for the authenticated admin.',
  })
  disableMfa(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.disableMfa(req.user.id);
  }

  @Post('mfa/backup-codes')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate new backup codes',
    description:
      'Generate new backup codes (invalidates old ones). Returns plain codes once - save them!',
  })
  generateBackupCodes(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.generateBackupCodes(req.user.id);
  }

  @Post('verify-action-mfa')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify MFA for sensitive action',
    description:
      'Verify MFA code before performing a sensitive action (e.g., approve transaction, update rates). Returns a short-lived action token.',
  })
  @ApiBody({ type: VerifyActionMfaDto })
  @ApiResponse({
    status: 200,
    description: 'MFA verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        actionToken: { type: 'string' },
        expiresIn: { type: 'number', description: 'Token expiry in seconds' },
      },
    },
  })
  verifyActionMfa(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyActionMfaDto,
  ) {
    return this.adminAuthService.verifyActionMfa(
      req.user.id,
      dto.code,
      dto.action,
    );
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check MFA status',
    description: 'Check if MFA is enabled for the current admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA status',
    schema: {
      type: 'object',
      properties: {
        mfaEnabled: { type: 'boolean' },
        mfaRequired: { type: 'boolean' },
      },
    },
  })
  getMfaStatus(@Req() req: AuthenticatedRequest) {
    return this.adminAuthService.checkMfaStatus(req.user.id);
  }

  @Post('ip-allowlist')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update IP allowlist',
    description:
      'Set allowed IP addresses for login. Empty array disables IP restriction.',
  })
  @ApiBody({ type: UpdateIpAllowlistDto })
  updateIpAllowlist(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateIpAllowlistDto,
  ) {
    return this.adminAuthService.updateIpAllowlist(req.user.id, dto);
  }
}
