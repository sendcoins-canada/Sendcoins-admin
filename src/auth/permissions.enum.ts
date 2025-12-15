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
  EXPORT_TRANSACTIONS = 'EXPORT_TRANSACTIONS',

  // Wallet management
  READ_WALLETS = 'READ_WALLETS',
  FREEZE_WALLETS = 'FREEZE_WALLETS',

  // Audit and compliance
  READ_AUDIT_LOGS = 'READ_AUDIT_LOGS',
  VERIFY_KYC = 'VERIFY_KYC',

  // Admin management
  MANAGE_ADMINS = 'MANAGE_ADMINS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  MANAGE_DEPARTMENTS = 'MANAGE_DEPARTMENTS',

  // Dashboard and analytics
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',

  // Data export
  EXPORT_DATA = 'EXPORT_DATA',
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
  { label: string; category: string; description: string }
> = {
  [Permission.READ_USERS]: {
    label: 'Read users',
    category: 'User Management',
    description: 'View user accounts and their details',
  },
  [Permission.SUSPEND_USERS]: {
    label: 'Suspend users',
    category: 'User Management',
    description: 'Suspend or ban user accounts',
  },
  [Permission.READ_TRANSACTIONS]: {
    label: 'Read transactions',
    category: 'Transaction Management',
    description: 'View transaction history and details',
  },
  [Permission.VERIFY_TRANSACTIONS]: {
    label: 'Verify transactions',
    category: 'Transaction Management',
    description: 'Approve, reject, or flag transactions',
  },
  [Permission.READ_TX_HASH]: {
    label: 'Read tx hash',
    category: 'Transaction Management',
    description: 'View blockchain transaction hashes',
  },
  [Permission.EXPORT_TRANSACTIONS]: {
    label: 'Export transactions',
    category: 'Transaction Management',
    description: 'Export transaction data to CSV/Excel',
  },
  [Permission.READ_WALLETS]: {
    label: 'Read wallets',
    category: 'Wallet Management',
    description: 'View wallet balances and addresses',
  },
  [Permission.FREEZE_WALLETS]: {
    label: 'Freeze wallets',
    category: 'Wallet Management',
    description: 'Freeze or unfreeze user wallets',
  },
  [Permission.READ_AUDIT_LOGS]: {
    label: 'Read audit logs',
    category: 'Audit & Compliance',
    description: 'View system audit logs',
  },
  [Permission.VERIFY_KYC]: {
    label: 'Verify KYC',
    category: 'Audit & Compliance',
    description: 'Review and verify KYC documents',
  },
  [Permission.MANAGE_ADMINS]: {
    label: 'Manage admins',
    category: 'Administration',
    description: 'Create, edit, and deactivate admin users',
  },
  [Permission.MANAGE_ROLES]: {
    label: 'Manage roles',
    category: 'Administration',
    description: 'Create, edit, and delete roles and permissions',
  },
  [Permission.MANAGE_DEPARTMENTS]: {
    label: 'Manage departments',
    category: 'Administration',
    description: 'Create, edit, and delete departments',
  },
  [Permission.VIEW_DASHBOARD]: {
    label: 'View dashboard',
    category: 'Dashboard & Analytics',
    description: 'Access the admin dashboard',
  },
  [Permission.VIEW_ANALYTICS]: {
    label: 'View analytics',
    category: 'Dashboard & Analytics',
    description: 'Access detailed analytics and reports',
  },
  [Permission.EXPORT_DATA]: {
    label: 'Export data',
    category: 'Data Management',
    description: 'Export system data in various formats',
  },
};

