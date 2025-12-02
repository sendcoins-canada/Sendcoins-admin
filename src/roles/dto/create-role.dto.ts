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
    example: 'Compliance Officer',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Optional description of the role',
    example: 'Handles compliance and KYC verification',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'List of permissions granted to this role. Only these permissions will be granted; all others are denied by default.',
    example: [Permission.READ_USERS, Permission.VERIFY_KYC],
    type: [String],
    enum: Permission,
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}


