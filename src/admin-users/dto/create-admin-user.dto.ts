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
  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 1,
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
    example: AdminRole.ENGINEER,
    description:
      'Legacy role enum. Required field, but ignored if roleId is provided. Use roleId for dynamic roles with permissions.',
  })
  @IsEnum(AdminRole)
  role!: AdminRole;

  @ApiProperty({
    example: 1,
    required: false,
    description:
      'Dynamic role ID (optional). If provided, takes precedence over the legacy role enum. The role must exist and be ACTIVE.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  roleId?: number;
}
