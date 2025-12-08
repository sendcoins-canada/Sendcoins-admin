import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { AdminAuthAuditService } from './admin-audit.service';
import { PermissionsGuard } from './permissions.guard';
import { MfaService } from './mfa.service';

// Validate JWT_SECRET at startup - fail fast if not configured in production
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable is required in production. ' +
        'Please set a secure, random string of at least 32 characters.',
    );
  }
  if (!secret) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET not set. Using insecure default for development only.',
    );
    return 'dev-jwt-secret-change-me-not-for-production';
  }
  if (secret.length < 32) {
    console.warn(
      '⚠️  WARNING: JWT_SECRET is less than 32 characters. Consider using a longer secret.',
    );
  }
  return secret;
};

@Module({
  imports: [
    PrismaModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [
    AdminAuthService,
    JwtStrategy,
    AdminAuthAuditService,
    PermissionsGuard,
    MfaService,
  ],
  controllers: [AdminAuthController],
  exports: [JwtModule, PermissionsGuard],
})
export class AuthModule {}
