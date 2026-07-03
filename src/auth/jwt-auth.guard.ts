import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_MFA_SETUP_KEY } from './allow-mfa-setup.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { mfaSetup?: boolean } }>();

    // Restricted MFA-setup tokens may only reach routes explicitly
    // opted in via @AllowMfaSetupToken().
    if (request.user?.mfaSetup) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_MFA_SETUP_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException(
          'MFA setup required. Complete MFA setup before accessing this resource.',
        );
      }
    }

    return true;
  }
}
