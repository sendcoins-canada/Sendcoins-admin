import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/roles.enum';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new role',
    description:
      'Create a new role with specified permissions. Only SUPER_ADMIN can create roles.',
  })
  @ApiBody({ type: CreateRoleDto })
  create(
    @Body() dto: CreateRoleDto,
    @Req()
    req: {
      user?: { id: number };
    },
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.rolesService.create(dto, req.user.id);
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE, AdminRole.ENGINEER)
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Returns a list of all roles with their permissions.',
  })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE, AdminRole.ENGINEER)
  @ApiOperation({
    summary: 'Get a role by ID',
    description: 'Returns detailed information about a specific role.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Role ID' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(Number(id));
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a role',
    description:
      'Update role details and permissions. Only SUPER_ADMIN can update roles.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Role ID' })
  @ApiBody({ type: UpdateRoleDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req()
    req: {
      user?: { id: number };
    },
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.rolesService.update(Number(id), dto, req.user.id);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete a role',
    description:
      'Delete a role. Only works if the role is not assigned to any admin users. Only SUPER_ADMIN can delete roles.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Role ID' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(Number(id));
  }
}
