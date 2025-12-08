import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Response types for type safety
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  admin: {
    email: string;
    role: string;
  };
}

interface ErrorResponse {
  message: string;
  statusCode: number;
}

interface SessionsResponse {
  sessions: Array<{
    id: number;
    deviceInfo: string;
    ipAddress: string;
    createdAt: string;
    expiresAt: string;
  }>;
}

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

  describe('Authentication', () => {
    it('/auth/admin/login (POST) returns access and refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ email: seedAdminEmail, password: seedAdminPassword })
        .expect(201);

      const body = res.body as LoginResponse;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('expiresIn');
      expect(body.admin).toMatchObject({
        email: seedAdminEmail.toLowerCase(),
        role: 'SUPER_ADMIN',
      });
    });

    it('/auth/admin/login (POST) fails with invalid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ email: seedAdminEmail, password: 'wrongpassword' })
        .expect(401);

      const body = res.body as ErrorResponse;
      expect(body.message).toBe('Invalid credentials');
    });

    it('/auth/admin/refresh (POST) returns new tokens', async () => {
      // First login to get refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ email: seedAdminEmail, password: seedAdminPassword })
        .expect(201);

      const loginBody = loginRes.body as LoginResponse;
      const refreshToken = loginBody.refreshToken;

      // Use refresh token to get new access token
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/admin/refresh')
        .send({ refreshToken })
        .expect(201);

      const refreshBody = refreshRes.body as LoginResponse;
      expect(refreshBody).toHaveProperty('accessToken');
      expect(refreshBody).toHaveProperty('refreshToken');
      // New refresh token should be different (rotation)
      expect(refreshBody.refreshToken).not.toBe(refreshToken);
    });

    it('/auth/admin/logout (POST) revokes refresh token', async () => {
      // First login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ email: seedAdminEmail, password: seedAdminPassword })
        .expect(201);

      const loginBody = loginRes.body as LoginResponse;
      const refreshToken = loginBody.refreshToken;

      // Logout
      await request(app.getHttpServer())
        .post('/auth/admin/logout')
        .send({ refreshToken })
        .expect(201);

      // Try to use revoked token
      await request(app.getHttpServer())
        .post('/auth/admin/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/admin/login')
        .send({ email: seedAdminEmail, password: seedAdminPassword });

      const body = res.body as LoginResponse;
      accessToken = body.accessToken;
    });

    it('/auth/admin/sessions (GET) returns active sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/admin/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as SessionsResponse;
      expect(body).toHaveProperty('sessions');
      expect(Array.isArray(body.sessions)).toBe(true);
    });

    it('Protected routes reject requests without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/admin/sessions')
        .expect(401);
    });
  });
});
