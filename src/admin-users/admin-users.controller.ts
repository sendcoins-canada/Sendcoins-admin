import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/roles.enum';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('AdminUsers')
@ApiBearerAuth()
@Controller('admin-users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create admin user',
    description:
      'Create a new admin user and email them a password setup link.',
  })
  @ApiBody({ type: CreateAdminUserDto })
  create(@Body() dto: CreateAdminUserDto) {
    return this.adminUsersService.createAdmin(dto);
  }

  @Post(':id/resend-invite')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Resend password setup invite',
    description:
      'Resend the password setup email to an admin whose password is not yet set.',
  })
  resendInvite(@Param('id') id: string) {
    return this.adminUsersService.resendInvite(Number(id));
  }
}


