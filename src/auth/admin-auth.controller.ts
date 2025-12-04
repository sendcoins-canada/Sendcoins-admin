import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
  Ip,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ValidatePasswordTokenDto } from './dto/validate-password-token.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { UpdateIpAllowlistDto } from './dto/update-ip-allowlist.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('AdminAuth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate an admin user. If MFA is enabled, returns a temporary token for MFA verification.',
  })
  @ApiBody({ type: AdminLoginDto })
  login(@Body() dto: AdminLoginDto, @Ip() clientIp: string) {
    return this.adminAuthService.login(dto.email, dto.password, clientIp);
  }

  @Post('verify-mfa')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Verify MFA code',
    description:
      'Complete login by verifying MFA code (TOTP or backup code) using temporary token from login.',
  })
  @ApiBody({ type: VerifyMfaDto })
  verifyMfa(@Body() dto: VerifyMfaDto) {
    return this.adminAuthService.verifyMfa(dto);
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
  startMfaSetup(@Req() req: any) {
    return this.adminAuthService.startMfaSetup(req.user.id);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enable MFA',
    description:
      'Complete MFA setup by verifying a TOTP code. Returns backup codes (save them!).',
  })
  @ApiBody({ type: EnableMfaDto })
  enableMfa(@Req() req: any, @Body() dto: EnableMfaDto) {
    return this.adminAuthService.enableMfa(req.user.id, dto);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable MFA',
    description: 'Disable MFA for the authenticated admin.',
  })
  disableMfa(@Req() req: any) {
    return this.adminAuthService.disableMfa(req.user.id);
  }

  @Post('mfa/backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate new backup codes',
    description:
      'Generate new backup codes (invalidates old ones). Returns plain codes once - save them!',
  })
  generateBackupCodes(@Req() req: any) {
    return this.adminAuthService.generateBackupCodes(req.user.id);
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
  updateIpAllowlist(@Req() req: any, @Body() dto: UpdateIpAllowlistDto) {
    return this.adminAuthService.updateIpAllowlist(req.user.id, dto);
  }
}
