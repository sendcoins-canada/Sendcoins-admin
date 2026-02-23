import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MfaActionGuard } from '../auth/mfa-action.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import { EmailsService } from './emails.service';
import { SendEmailDto } from './dto/send-email.dto';

@Controller('emails')
@UseGuards(JwtAuthGuard, PermissionsGuard, MfaActionGuard)
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @Post('send')
  @RequirePermission(Permission.MANAGE_ADMINS)
  async send(@Body() dto: SendEmailDto, @Request() req: { user: { id: number } }) {
    return this.emailsService.sendAndSave(dto, req.user.id);
  }

  @Get()
  @RequirePermission(Permission.VIEW_ANALYTICS)
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.emailsService.list({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
    });
  }

  @Get(':id')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  async getOne(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return null;
    return this.emailsService.getOne(numId);
  }
}
