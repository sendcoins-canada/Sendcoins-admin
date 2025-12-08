import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
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
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @RequirePermission(Permission.MANAGE_DEPARTMENTS)
  @ApiOperation({
    summary: 'Create a new department',
    description:
      'Create a new department. Requires MANAGE_DEPARTMENTS permission.',
  })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({
    status: 201,
    description: 'Department created successfully',
  })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  @RequirePermission(Permission.MANAGE_DEPARTMENTS)
  @ApiOperation({
    summary: 'Get all departments',
    description: 'Returns a list of all departments with admin counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of departments',
  })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @RequirePermission(Permission.MANAGE_DEPARTMENTS)
  @ApiOperation({
    summary: 'Get a department by ID',
    description: 'Returns detailed information about a specific department.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Department ID' })
  @ApiResponse({
    status: 200,
    description: 'Department details',
  })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(Number(id));
  }

  @Patch(':id')
  @RequirePermission(Permission.MANAGE_DEPARTMENTS)
  @ApiOperation({
    summary: 'Update a department',
    description:
      'Update department details. Requires MANAGE_DEPARTMENTS permission.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Department ID' })
  @ApiBody({ type: UpdateDepartmentDto })
  @ApiResponse({
    status: 200,
    description: 'Department updated successfully',
  })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(Number(id), dto);
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_DEPARTMENTS)
  @ApiOperation({
    summary: 'Delete a department',
    description:
      'Delete a department. Only works if the department is not assigned to any admin users. Requires MANAGE_DEPARTMENTS permission.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Department ID' })
  @ApiResponse({
    status: 200,
    description: 'Department deleted successfully',
  })
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(Number(id));
  }
}
