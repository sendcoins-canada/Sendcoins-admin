/**
 * System-wide permissions that can be assigned to roles
 * These are predefined and cannot be created/deleted via API
 */
export enum Permission {
  // User management
  READ_USERS = 'READ_USERS',
  SUSPEND_USERS = 'SUSPEND_USERS',

  // Transaction management
  READ_TRANSACTIONS = 'READ_TRANSACTIONS',
  VERIFY_TRANSACTIONS = 'VERIFY_TRANSACTIONS',
  READ_TX_HASH = 'READ_TX_HASH',

  // Wallet management
  READ_WALLETS = 'READ_WALLETS',
  FREEZE_WALLETS = 'FREEZE_WALLETS',

  // Audit and compliance
  READ_AUDIT_LOGS = 'READ_AUDIT_LOGS',
  VERIFY_KYC = 'VERIFY_KYC',
}

/**
 * All available permissions as an array (for easy iteration)
 */
export const ALL_PERMISSIONS = Object.values(Permission);

/**
 * Permission metadata for display purposes
 */
export const PERMISSION_METADATA: Record<
  Permission,
  { label: string; category: string }
> = {
  [Permission.READ_USERS]: { label: 'Read users', category: 'User Management' },
  [Permission.SUSPEND_USERS]: {
    label: 'Suspend users',
    category: 'User Management',
  },
  [Permission.READ_TRANSACTIONS]: {
    label: 'Read transactions',
    category: 'Transaction Management',
  },
  [Permission.VERIFY_TRANSACTIONS]: {
    label: 'Verify transactions',
    category: 'Transaction Management',
  },
  [Permission.READ_TX_HASH]: {
    label: 'Read tx hash',
    category: 'Transaction Management',
  },
  [Permission.READ_WALLETS]: {
    label: 'Read wallets',
    category: 'Wallet Management',
  },
  [Permission.FREEZE_WALLETS]: {
    label: 'Freeze wallets',
    category: 'Wallet Management',
  },
  [Permission.READ_AUDIT_LOGS]: {
    label: 'Read audit logs',
    category: 'Audit & Compliance',
  },
  [Permission.VERIFY_KYC]: {
    label: 'Verify KYC',
    category: 'Audit & Compliance',
  },
};


