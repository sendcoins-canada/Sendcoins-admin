import { SetMetadata } from '@nestjs/common';

export const ALLOW_MFA_SETUP_KEY = 'allowMfaSetupToken';

/**
 * Marks a route as accessible with a restricted MFA-setup token
 * (issued at login when ADMIN_MFA_ENFORCED=true and the admin has
 * not yet enabled MFA). All other routes reject such tokens.
 */
export const AllowMfaSetupToken = () => SetMetadata(ALLOW_MFA_SETUP_KEY, true);
