import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AdminRole } from '../../auth/roles.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminUserDto {
  @ApiProperty({})
  @IsString()
  firstName!: string;

  @ApiProperty({})
  @IsString()
  lastName!: string;

  @ApiProperty({})
  @IsEmail()
  email!: string;

  @ApiProperty({
    required: false,
    description:
      'Department ID (optional). The department must exist in the database.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiProperty({
    enum: AdminRole,
    description:
      'Legacy role enum. Required field, but ignored if roleId is provided. Use roleId for dynamic roles with permissions.',
  })
  @IsEnum(AdminRole)
  role!: AdminRole;

  @ApiProperty({
    required: false,
    description:
      'Dynamic role ID (optional). If provided, takes precedence over the legacy role enum. The role must exist and be ACTIVE.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  roleId?: number;
}
