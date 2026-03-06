import { PrismaClient, Permission } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allPermissions = Object.values(Permission);

  const roles = await prisma.role.findMany({
    include: {
      permissions: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log('=== Permission Health Check ===');

  for (const role of roles) {
    const rolePerms = role.permissions.map((p) => p.permission);
    const missing = allPermissions.filter((perm) => !rolePerms.includes(perm));

    if (missing.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`Role "${role.title}" (id=${role.id}) has all permissions.`);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `Role "${role.title}" (id=${role.id}) is missing permissions: ${missing.join(', ')}`,
      );
    }
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Permission healthcheck failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

