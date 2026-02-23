import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthService } from './admin-auth.service';
import { REQUIRE_MFA_KEY } from './require-mfa.decorator';

/**
 * Guard that validates MFA action tokens for sensitive operations.
 *
 * The action token should be passed in the X-MFA-Token header.
 * If the user doesn't have MFA enabled, the action is allowed without a token.
 */
@Injectable()
export class MfaActionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if MFA is required for this endpoint
    const requiresMfa = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_MFA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If MFA not required for this endpoint, allow
    if (!requiresMfa) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: number };
      headers: Record<string, string>;
      body?: { actionToken?: string };
    }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has MFA enabled
    const mfaStatus = await this.authService.checkMfaStatus(user.id);

    // If MFA is not enabled, allow the action without token
    if (!mfaStatus.mfaEnabled) {
      return true;
    }

    // MFA is enabled, so we need to validate the action token
    // Token can come from header or body
    const actionToken =
      request.headers['x-mfa-token'] ||
      request.headers['X-MFA-Token'] ||
      request.body?.actionToken;

    if (!actionToken) {
      throw new ForbiddenException(
        'MFA verification required. Please provide an action token.',
      );
    }

    // Validate the action token
    const validation = await this.authService.validateActionToken(
      actionToken,
      user.id,
    );

    if (!validation.valid) {
      throw new ForbiddenException(
        'Invalid or expired MFA action token. Please verify MFA again.',
      );
    }

    return true;
  }
}
