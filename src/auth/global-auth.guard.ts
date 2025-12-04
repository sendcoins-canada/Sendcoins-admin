import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

// Endpoints that are allowed without JWT (public)
const PUBLIC_PATHS: { method: string; pathPrefix: string }[] = [
  { method: 'GET', pathPrefix: '/health' },
  { method: 'GET', pathPrefix: '/permissions' }, // Public - just lists available permissions
  { method: 'POST', pathPrefix: '/auth/admin/login' },
  { method: 'POST', pathPrefix: '/auth/admin/verify-mfa' },
  { method: 'POST', pathPrefix: '/auth/admin/forgot-password' },
  { method: 'POST', pathPrefix: '/auth/admin/set-password' },
  { method: 'POST', pathPrefix: '/auth/admin/validate-password-token' },
];

@Injectable()
export class GlobalAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { path: string }>();
    const method = (request.method || 'GET').toUpperCase();
    const path = request.path || '';

    const isPublic = PUBLIC_PATHS.some(
      (p) => p.method === method && path.startsWith(p.pathPrefix),
    );

    if (isPublic) {
      return true;
    }

    return super.canActivate(context) as Promise<boolean> | boolean;
  }
}
