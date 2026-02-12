import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiParam,
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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

  @Get('stats')
  @RequirePermission(Permission.READ_USERS)
  @ApiOperation({
    summary: 'Get user statistics',
    description: 'Returns statistics about users including total, active, suspended, and KYC status counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        active: { type: 'number' },
        suspended: { type: 'number' },
        banned: { type: 'number' },
        pendingKyc: { type: 'number' },
        verifiedKyc: { type: 'number' },
      },
    },
  })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @RequirePermission(Permission.READ_USERS)
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Returns detailed information about a specific user by their azer_id. Requires READ_USERS permission.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'User ID (azer_id)',
  })
  @ApiResponse({
    status: 200,
    description: 'User information',
    schema: {
      type: 'object',
      properties: {
        azer_id: { type: 'number' },
        first_name: { type: 'string', nullable: true },
        last_name: { type: 'string', nullable: true },
        user_email: { type: 'string', nullable: true },
        verify_user: { type: 'boolean', nullable: true },
        device: { type: 'string', nullable: true },
        ip_addr: { type: 'string', nullable: true },
        logincount: { type: 'string' },
        profession: { type: 'string', nullable: true },
        offeredsolution: { type: 'string', nullable: true },
        solutiontype: { type: 'string', nullable: true },
        country: { type: 'string', nullable: true },
        location: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        device_security: { type: 'string' },
        activity_notify: { type: 'string', nullable: true },
        default_currency: { type: 'string', nullable: true },
        address: { type: 'string', nullable: true },
        linkedin: { type: 'string', nullable: true },
        facebook: { type: 'string', nullable: true },
        twitter: { type: 'string', nullable: true },
        instagram: { type: 'string', nullable: true },
        github: { type: 'string', nullable: true },
        profile_pix: { type: 'string', nullable: true },
        webite: { type: 'string', nullable: true },
        company_logo: { type: 'string', nullable: true },
        company_name: { type: 'string', nullable: true },
        company_verify: { type: 'string' },
        country_iso2: { type: 'string', nullable: true },
        account_ban: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        referal_id: { type: 'string', nullable: true },
        referee: { type: 'string', nullable: true },
        google_id: { type: 'string', nullable: true },
        oauth_provider: { type: 'string', nullable: true },
        apple_id: { type: 'string', nullable: true },
        apple_verified: { type: 'boolean', nullable: true },
        is_private_email: { type: 'boolean', nullable: true },
        auth_provider: { type: 'string', nullable: true },
        last_login_ip: { type: 'string', nullable: true },
        last_login_location: { type: 'string', nullable: true },
        last_login_at: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post(':id/suspend')
  @RequirePermission(Permission.SUSPEND_USERS)
  @ApiOperation({
    summary: 'Suspend a user',
    description: 'Suspend a user account, preventing them from logging in or making transactions.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'User ID (azer_id)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for suspension' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User suspended successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async suspendUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ) {
    return this.usersService.suspendUser(id, body.reason);
  }

  @Post(':id/unsuspend')
  @RequirePermission(Permission.SUSPEND_USERS)
  @ApiOperation({
    summary: 'Unsuspend a user',
    description: 'Unsuspend a previously suspended user account.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'User ID (azer_id)',
  })
  @ApiResponse({
    status: 200,
    description: 'User unsuspended successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async unsuspendUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.unsuspendUser(id);
  }

  @Get(':id/activity')
  @RequirePermission(Permission.READ_USERS)
  @ApiOperation({
    summary: 'Get user activity',
    description: 'Get the activity log for a specific user.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'User ID (azer_id)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'User activity log',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserActivity(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getActivity(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
