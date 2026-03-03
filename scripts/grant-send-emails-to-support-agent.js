// One-off script to grant SEND_EMAILS permission to the "Support Agent" role.
// Usage:
//   cd sendcoins-admin
//   node scripts/grant-send-emails-to-support-agent.js

/* eslint-disable no-console */

const { PrismaClient, Permission } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // Ensure the SEND_EMAILS enum value exists in the database
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'Permission'
            AND e.enumlabel = 'SEND_EMAILS'
        ) THEN
          ALTER TYPE "Permission" ADD VALUE 'SEND_EMAILS';
        END IF;
      END
      $$;
    `);

    // Find the Support Agent role by title (fallback to id=2 if needed)
    let role = await prisma.role.findFirst({
      where: { title: 'Support Agent' },
    });

    if (!role) {
      role = await prisma.role.findUnique({ where: { id: 2 } });
    }

    if (!role) {
      console.error('Support Agent role not found (title="Support Agent" or id=2).');
      return;
    }

    console.log(`Found role "${role.title}" with id=${role.id}. Granting SEND_EMAILS permission...`);

    await prisma.rolePermission.upsert({
      where: {
        roleId_permission: {
          roleId: role.id,
          permission: Permission.SEND_EMAILS,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        roleId: role.id,
        permission: Permission.SEND_EMAILS,
        isActive: true,
      },
    });

    console.log('✅ SEND_EMAILS permission granted to Support Agent role.');
  } catch (err) {
    console.error('Error granting SEND_EMAILS permission:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

