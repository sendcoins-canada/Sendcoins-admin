import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../auth/permissions.enum';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Title/name of the role',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Optional description of the role',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'List of permissions granted to this role. Only these permissions will be granted; all others are denied by default.',
    type: [String],
    enum: Permission,
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}

