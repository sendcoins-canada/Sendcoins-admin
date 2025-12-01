import { Module } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditService } from './admin-audit.service';

@Module({
  imports: [PrismaModule, MailModule, AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminAuditService],
})
export class AdminUsersModule {}


