import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  @RequirePermission(Permission.SEND_EMAILS)
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  async send(
    @Body() dto: SendEmailDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: { user: { id: number } },
  ) {
    // Convert uploaded files to attachment format
    if (files?.length) {
      const fileAttachments = files.map((file) => ({
        filename: file.originalname,
        contentBase64: file.buffer.toString('base64'),
        contentType: file.mimetype,
      }));
      dto.attachments = [...(dto.attachments ?? []), ...fileAttachments];
    }

    return this.emailsService.sendAndSave(dto, req.user.id);
  }

  @Get()
  @RequirePermission(Permission.SEND_EMAILS)
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
  @RequirePermission(Permission.SEND_EMAILS)
  async getOne(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return null;
    return this.emailsService.getOne(numId);
  }
}
