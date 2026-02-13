import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../auth/permissions.enum';
import { RoleStatus } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'Title/name of the role',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: 'Optional description of the role',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Status of the role',
    enum: RoleStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(RoleStatus)
  status?: RoleStatus;

  @ApiProperty({
    description:
      'List of permissions granted to this role. Only these permissions will be granted; all others are denied by default.',
    type: [String],
    enum: Permission,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
