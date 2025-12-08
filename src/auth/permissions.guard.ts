import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import { Permission } from './permissions.enum';
import { AdminRole } from './roles.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: number; role?: AdminRole };
    }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN bypasses all permission checks

    if (user.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    // Get admin user with role and permissions

    const admin = await this.prisma.client.adminUser.findUnique({
      where: { id: user.id },
      include: {
        dynamicRole: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      throw new ForbiddenException('Admin user not found');
    }

    // If admin has no dynamic role, check legacy role
    // For now, legacy roles don't have permissions, so deny
    if (!admin.dynamicRole) {
      throw new ForbiddenException(
        'No role assigned. Please contact administrator.',
      );
    }

    // Check if role is active
    if (admin.dynamicRole.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your role is inactive. Please contact administrator.',
      );
    }

    // Get granted permissions (all permissions in the table are active)
    const grantedPermissions = admin.dynamicRole.permissions
      .filter((rp) => rp.isActive)
      .map((rp) => rp.permission);

    // Check if all required permissions are granted
    const hasAllPermissions = requiredPermissions.every((perm) =>
      grantedPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'You do not have permission to perform this action. Required permissions: ' +
          requiredPermissions.join(', '),
      );
    }

    return true;
  }
}
