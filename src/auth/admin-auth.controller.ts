import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ValidatePasswordTokenDto } from './dto/validate-password-token.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('AdminAuth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Admin login',
    description: 'Authenticate an admin user and return a JWT.',
  })
  @ApiBody({ type: AdminLoginDto })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto.email, dto.password);
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
}
