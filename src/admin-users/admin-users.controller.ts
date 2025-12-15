import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
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
} from '@nestjs/swagger';

@ApiTags('AdminUsers')
@ApiBearerAuth()
@Controller('admin-users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

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
        id: { type: 'number'},
        email: { type: 'string'},
        firstName: { type: 'string'},
        lastName: { type: 'string'},
        departmentId: { type: 'number', nullable: true },
        department: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'number'},
            name: { type: 'string'},
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
            id: { type: 'number'},
            title: { type: 'string'},
            status: { type: 'string'},
          },
        },
        status: { type: 'string'},
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
}
