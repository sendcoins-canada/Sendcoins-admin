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

@Module({
  imports: [
    PrismaModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [
    AdminAuthService,
    JwtStrategy,
    AdminAuthAuditService,
    PermissionsGuard,
  ],
  controllers: [AdminAuthController],
  exports: [JwtModule, PermissionsGuard],
})
export class AuthModule {}
