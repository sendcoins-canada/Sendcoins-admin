import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
import { AdminRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@ApiTags('AdminUsers')
@ApiBearerAuth()
@Controller('admin-users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Get all admin users',
    description:
      'Returns a paginated list of admin users with their roles and departments. Requires MANAGE_ADMINS permission.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'DEACTIVATED'],
  })
  @ApiQuery({ name: 'roleId', required: false, type: Number })
  @ApiQuery({ name: 'departmentId', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of admin users with pagination',
  })
  findAll(@Query() query: GetAdminUsersQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get(':id')
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Get admin user by ID',
    description: 'Returns detailed information about a specific admin user.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin user ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin user details',
  })
  @ApiResponse({
    status: 404,
    description: 'Admin user not found',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.findOne(id);
  }

  @Post()
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Create admin user',
    description:
      'Create a new admin user and email them a password setup link. You can assign a dynamic role (roleId) for fine-grained permissions, or use the legacy role enum. If roleId is provided, it takes precedence over the role enum. You can also assign a department (departmentId) from the departments list.',
  })
  @ApiBody({ type: CreateAdminUserDto })
  @ApiResponse({
    status: 201,
    description: 'Admin user created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        departmentId: { type: 'number', nullable: true },
        department: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            description: {
              type: 'string',
            },
          },
        },
        role: {
          type: 'string',
          enum: Object.values(AdminRole),
        },
        roleId: { type: 'number', nullable: true },
        dynamicRole: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
            status: { type: 'string' },
          },
        },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  create(@Body() dto: CreateAdminUserDto) {
    return this.adminUsersService.createAdmin(dto);
  }

  @Post(':id/resend-invite')
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Resend password setup invite',
    description:
      'Resend the password setup email to an admin whose password is not yet set.',
  })
  resendInvite(@Param('id') id: string) {
    return this.adminUsersService.resendInvite(Number(id));
  }

  @Patch(':id')
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Update admin user',
    description:
      'Update admin user details including name, role, and department. Requires MANAGE_ADMINS permission.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin user ID' })
  @ApiBody({ type: UpdateAdminUserDto })
  @ApiResponse({
    status: 200,
    description: 'Admin user updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Admin user not found',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminUsersService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Deactivate admin user',
    description:
      'Deactivate an admin user account. The user will no longer be able to login. Requires MANAGE_ADMINS permission.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin user ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin user deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Admin user not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate your own account',
  })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminUsersService.deactivate(id, req.user.id);
  }

  @Post(':id/reactivate')
  @RequirePermission(Permission.MANAGE_ADMINS)
  @ApiOperation({
    summary: 'Reactivate admin user',
    description:
      'Reactivate a previously deactivated admin user account. Requires MANAGE_ADMINS permission.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin user ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin user reactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Admin user not found',
  })
  reactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminUsersService.reactivate(id, req.user.id);
  }
}
