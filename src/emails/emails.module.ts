import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { NewsletterTemplateService } from './newsletter-template.service';

@Module({
  imports: [PrismaModule, MailModule, AuthModule],
  controllers: [EmailsController],
  providers: [EmailsService, NewsletterTemplateService],
  exports: [EmailsService],
})
export class EmailsModule {}
