import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.enum';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Decorator to require a specific permission for an endpoint
 * Usage: @RequirePermission(Permission.FREEZE_WALLETS)
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);




