import {
  Controller, Get, Post, Param, Res, Req,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request as ExpressReq } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MfaActionGuard } from '../auth/mfa-action.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import { PrismaService } from '../prisma/prisma.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upload an image (auth required). Returns a public URL.
   * Max 5MB, images only.
   */
  @Post('image')
  @UseGuards(JwtAuthGuard, PermissionsGuard, MfaActionGuard)
  @RequirePermission(Permission.SEND_EMAILS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'), false);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: ExpressReq & { user: { id: number } },
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }

    const record = await this.prisma.client.uploadedImage.create({
      data: {
        filename: file.originalname,
        mimeType: file.mimetype,
        data: file.buffer,
        size: file.size,
        createdBy: req.user.id,
      },
    });

    const baseUrl = process.env.ADMIN_API_URL
      || `${req.protocol}://${req.get('host') ?? 'localhost:4005'}`;

    return {
      id: record.id,
      url: `${baseUrl}/uploads/image/${record.id}`,
      filename: record.filename,
      size: record.size,
    };
  }

  /**
   * Serve an uploaded image by ID. No auth required — this URL goes into emails.
   */
  @Get('image/:id')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const record = await this.prisma.client.uploadedImage.findUnique({
      where: { id },
    });

    if (!record) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.set({
      'Content-Type': record.mimeType,
      'Content-Length': record.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.send(record.data);
  }
}
