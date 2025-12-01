import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(Permission.READ_USERS)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Returns a paginated list of users from the send_coin_user table. Requires READ_USERS permission. Supports filtering by email, country, and account ban status.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({
    name: 'accountBan',
    required: false,
    type: String,
    enum: ['true', 'false'],
  })
  @ApiResponse({
    status: 200,
    description: 'List of users with pagination',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              azer_id: { type: 'number' },
              first_name: { type: 'string', nullable: true },
              last_name: { type: 'string', nullable: true },
              user_email: { type: 'string', nullable: true },
              verify_user: { type: 'boolean', nullable: true },
              country: { type: 'string', nullable: true },
              account_ban: { type: 'string', nullable: true },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async getAllUsers(@Query() query: GetUsersQueryDto) {
    return this.usersService.findAll(query);
  }
}
