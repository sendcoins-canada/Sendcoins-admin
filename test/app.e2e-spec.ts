import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('App e2e', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();
  const seedAdminEmail = 'e2e-admin@example.com';
  const seedAdminPassword = 'Admin123!@#';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const passwordHash = await bcrypt.hash(seedAdminPassword, 10);

    await prisma.adminUser.upsert({
      where: { email: seedAdminEmail },
      update: {
        password: passwordHash,
        status: AdminStatus.ACTIVE,
        passwordSet: true,
      },
      create: {
        email: seedAdminEmail,
        firstName: 'E2E',
        lastName: 'Admin',
        departmentId: null, // No department for e2e test user
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE,
        password: passwordHash,
        passwordSet: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({
      where: { email: seedAdminEmail },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Hello World!');
  });

  it('/auth/admin/login (POST) returns JWT for seeded admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: seedAdminEmail, password: seedAdminPassword })
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.body.admin).toMatchObject({
      email: seedAdminEmail.toLowerCase(),
      role: 'SUPER_ADMIN',
    });
  });
});
