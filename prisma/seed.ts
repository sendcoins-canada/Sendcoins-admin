import { PrismaClient, AdminRole, AdminStatus, Permission, RoleStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create departments first
  const engineeringDept = await prisma.department.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Engineering',
      description: 'Handles product development and technical operations',
    },
  });

  const complianceDept = await prisma.department.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'Compliance',
      description: 'Handles compliance, KYC verification, and regulatory matters',
    },
  });

  const supportDept = await prisma.department.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: 'Customer Support',
      description: 'Provides customer support and assistance',
    },
  });

  const securityDept = await prisma.department.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: 'Security',
      description: 'Handles security operations and threat management',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded departments:', {
    engineering: engineeringDept.name,
    compliance: complianceDept.name,
    support: supportDept.name,
    security: securityDept.name,
  });

  // Seed a local SUPER_ADMIN account for Tobiloba (temporary, will be updated with role)
  const email = 'tobiloba.a.salau@gmail.com';
  const plainPassword = 'Admin123!@#'; // local/dev only – change in production

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const superAdmin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      departmentId: engineeringDept.id,
    },
    create: {
      email,
      firstName: 'Tobiloba',
      lastName: 'Salau',
      profile: 'https://ui-avatars.com/api/?name=Tobiloba+Salau&background=0D8ABC&color=fff&size=200',
      departmentId: engineeringDept.id,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      password: passwordHash,
      passwordSet: true,
    },
  });

  // Create roles with permissions
  // First, create Super Admin role with ALL permissions
  const allPermissions = Object.values(Permission);
  const superAdminRole = await prisma.role.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      title: 'Super Admin',
      description: 'Full system access with all permissions',
      status: RoleStatus.ACTIVE,
      createdById: superAdmin.id,
      permissions: {
        create: allPermissions.map((permission) => ({
          permission,
          isActive: true,
        })),
      },
    },
    include: { permissions: true },
  });

  // Update super admin user to have the Super Admin role
  await prisma.adminUser.update({
    where: { id: superAdmin.id },
    data: {
      roleId: superAdminRole.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded SUPER_ADMIN admin user:', {
    email: superAdmin.email,
    role: superAdmin.role,
    roleId: superAdminRole.id,
    password: plainPassword,
  });

  // Create other roles with permissions
  const complianceOfficerRole = await prisma.role.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      title: 'Compliance Officer',
      description: 'Handles compliance, KYC verification, and user management',
      status: RoleStatus.ACTIVE,
      createdById: superAdmin.id,
      permissions: {
        create: [
          { permission: Permission.READ_USERS, isActive: true },
          { permission: Permission.READ_TRANSACTIONS, isActive: true },
          { permission: Permission.READ_WALLETS, isActive: true },
          { permission: Permission.READ_AUDIT_LOGS, isActive: true },
          { permission: Permission.VERIFY_KYC, isActive: true },
          { permission: Permission.VERIFY_TRANSACTIONS, isActive: true },
        ],
      },
    },
    include: { permissions: true },
  });

  const supportAgentRole = await prisma.role.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      title: 'Support Agent',
      description: 'Read-only access for customer support',
      status: RoleStatus.ACTIVE,
      createdById: superAdmin.id,
      permissions: {
        create: [
          { permission: Permission.READ_USERS, isActive: true },
          { permission: Permission.READ_TRANSACTIONS, isActive: true },
          { permission: Permission.READ_WALLETS, isActive: true },
        ],
      },
    },
    include: { permissions: true },
  });

  const securityOfficerRole = await prisma.role.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      title: 'Security Officer',
      description: 'Full access to suspend users and freeze wallets',
      status: RoleStatus.ACTIVE,
      createdById: superAdmin.id,
      permissions: {
        create: [
          { permission: Permission.READ_USERS, isActive: true },
          { permission: Permission.SUSPEND_USERS, isActive: true },
          { permission: Permission.READ_TRANSACTIONS, isActive: true },
          { permission: Permission.READ_TX_HASH, isActive: true },
          { permission: Permission.READ_WALLETS, isActive: true },
          { permission: Permission.FREEZE_WALLETS, isActive: true },
          { permission: Permission.READ_AUDIT_LOGS, isActive: true },
        ],
      },
    },
    include: { permissions: true },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded roles:', {
    superAdmin: {
      id: superAdminRole.id,
      title: superAdminRole.title,
      permissions: superAdminRole.permissions.map((p) => p.permission),
      permissionCount: superAdminRole.permissions.length,
    },
    complianceOfficer: {
      id: complianceOfficerRole.id,
      title: complianceOfficerRole.title,
      permissions: complianceOfficerRole.permissions.map((p) => p.permission),
    },
    supportAgent: {
      id: supportAgentRole.id,
      title: supportAgentRole.title,
      permissions: supportAgentRole.permissions.map((p) => p.permission),
    },
    securityOfficer: {
      id: securityOfficerRole.id,
      title: securityOfficerRole.title,
      permissions: securityOfficerRole.permissions.map((p) => p.permission),
    },
  });

  // Create admin users with dynamic roles
  const complianceAdminPassword = await bcrypt.hash('Compliance123!@#', 10);
  const complianceAdmin = await prisma.adminUser.upsert({
    where: { email: 'compliance@sendcoins.com' },
    update: {},
    create: {
      email: 'compliance@sendcoins.com',
      firstName: 'Jane',
      lastName: 'Compliance',
      profile: 'https://ui-avatars.com/api/?name=Jane+Compliance&background=10B981&color=fff&size=200',
      departmentId: complianceDept.id,
      role: AdminRole.COMPLIANCE, // Legacy role for backward compatibility
      roleId: complianceOfficerRole.id, // Dynamic role with permissions
      status: AdminStatus.ACTIVE,
      password: complianceAdminPassword,
      passwordSet: true,
    },
  });

  const supportAdminPassword = await bcrypt.hash('Support123!@#', 10);
  const supportAdmin = await prisma.adminUser.upsert({
    where: { email: 'support@sendcoins.com' },
    update: {},
    create: {
      email: 'support@sendcoins.com',
      firstName: 'John',
      lastName: 'Support',
      profile: 'https://ui-avatars.com/api/?name=John+Support&background=6366F1&color=fff&size=200',
      departmentId: supportDept.id,
      role: AdminRole.ENGINEER, // Legacy role
      roleId: supportAgentRole.id, // Dynamic role with limited permissions
      status: AdminStatus.ACTIVE,
      password: supportAdminPassword,
      passwordSet: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded admin users with roles:', {
    complianceAdmin: {
      email: complianceAdmin.email,
      roleId: complianceAdmin.roleId,
      password: 'Compliance123!@#',
    },
    supportAdmin: {
      email: supportAdmin.email,
      roleId: supportAdmin.roleId,
      password: 'Support123!@#',
    },
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


