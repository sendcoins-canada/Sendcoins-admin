import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Seed a local SUPER_ADMIN account for Tobiloba
  const email = 'tobiloba.a.salau@gmail.com';
  const plainPassword = 'Admin123!@#'; // local/dev only – change in production

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: 'Tobiloba',
      lastName: 'Salau',
      department: 'Engineering',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      password: passwordHash,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded SUPER_ADMIN admin user:', {
    email: admin.email,
    role: admin.role,
    password: plainPassword,
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


