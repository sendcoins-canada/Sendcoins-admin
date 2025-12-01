import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    // Check for duplicate name
    const existing = await this.prisma.client.department.findFirst({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Department with this name already exists');
    }

    const department = await this.prisma.client.department.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    return department;
  }

  async findAll() {
    const departments = await this.prisma.client.department.findMany({
      include: {
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      adminCount: dept._count.adminUsers,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    }));
  }

  async findOne(id: number) {
    const department = await this.prisma.client.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return {
      id: department.id,
      name: department.name,
      description: department.description,
      adminCount: department._count.adminUsers,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    const department = await this.prisma.client.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== department.name) {
      const existing = await this.prisma.client.department.findFirst({
        where: { name: dto.name },
      });

      if (existing) {
        throw new ConflictException('Department with this name already exists');
      }
    }

    const updateData: Prisma.DepartmentUpdateInput = {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
    };

    const updated = await this.prisma.client.department.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      adminCount: updated._count.adminUsers,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async remove(id: number) {
    const department = await this.prisma.client.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            adminUsers: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    // Check if department is assigned to any admins
    if (department._count.adminUsers > 0) {
      throw new BadRequestException(
        `Cannot delete department: it is assigned to ${department._count.adminUsers} admin user(s). Please reassign or remove admins first.`,
      );
    }

    await this.prisma.client.department.delete({
      where: { id },
    });

    return { success: true };
  }
}
