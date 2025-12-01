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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/roles.enum';
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new department',
    description:
      'Create a new department. Only SUPER_ADMIN can create departments.',
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
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE, AdminRole.ENGINEER)
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
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.COMPLIANCE, AdminRole.ENGINEER)
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
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a department',
    description:
      'Update department details. Only SUPER_ADMIN can update departments.',
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
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete a department',
    description:
      'Delete a department. Only works if the department is not assigned to any admin users. Only SUPER_ADMIN can delete departments.',
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
