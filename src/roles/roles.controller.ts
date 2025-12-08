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
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';
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
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({
    summary: 'Create a new role',
    description:
      'Create a new role with specified permissions. Requires MANAGE_ROLES permission.',
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
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Returns a list of all roles with their permissions.',
  })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({
    summary: 'Get a role by ID',
    description: 'Returns detailed information about a specific role.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Role ID' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(Number(id));
  }

  @Patch(':id')
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({
    summary: 'Update a role',
    description:
      'Update role details and permissions. Requires MANAGE_ROLES permission.',
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
  @RequirePermission(Permission.MANAGE_ROLES)
  @ApiOperation({
    summary: 'Delete a role',
    description:
      'Delete a role. Only works if the role is not assigned to any admin users. Requires MANAGE_ROLES permission.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Role ID' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(Number(id));
  }
}
