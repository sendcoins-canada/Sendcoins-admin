import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MFA_KEY = 'requireMfa';

/**
 * Decorator to mark an endpoint as requiring MFA verification.
 *
 * When applied, the MfaActionGuard will check for a valid MFA action token.
 * If the user has MFA enabled, they must provide a valid action token.
 * If the user doesn't have MFA enabled, the action is allowed without a token.
 *
 * Usage:
 * ```
 * @RequireMfa()
 * @Post('approve')
 * async approveTransaction(...) { ... }
 * ```
 */
export const RequireMfa = () => SetMetadata(REQUIRE_MFA_KEY, true);
