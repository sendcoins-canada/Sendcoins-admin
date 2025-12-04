import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { RolesModule } from './roles/roles.module';
import { DepartmentsModule } from './departments/departments.module';
import { UsersModule } from './users/users.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GlobalAuthGuard } from './auth/global-auth.guard';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    AuthModule,
    AdminUsersModule,
    RolesModule,
    DepartmentsModule,
    UsersModule,
    AuditLogsModule,
    TransactionsModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
