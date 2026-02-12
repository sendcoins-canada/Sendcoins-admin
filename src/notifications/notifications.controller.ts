import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import {
  GetNotificationsDto,
  MarkNotificationsReadDto,
  DeleteNotificationsDto,
} from './dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current admin' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated notifications',
  })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() dto: GetNotificationsDto,
  ) {
    return this.notificationsService.findAll(req.user.id, dto);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get notification counts' })
  @ApiResponse({
    status: 200,
    description: 'Returns total, unread, and counts by category',
  })
  async getCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark specific notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Returns number of notifications updated',
  })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MarkNotificationsReadDto,
  ) {
    return this.notificationsService.markAsRead(req.user.id, dto.notificationIds);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Returns number of notifications updated',
  })
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete specific notifications' })
  @ApiResponse({
    status: 200,
    description: 'Returns number of notifications deleted',
  })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeleteNotificationsDto,
  ) {
    return this.notificationsService.delete(req.user.id, dto.notificationIds);
  }
}
