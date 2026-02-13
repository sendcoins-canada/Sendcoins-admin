import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AdminRole } from '../../auth/roles.enum';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAdminUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    required: false,
    description: 'Department ID. Set to null to remove from department.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  departmentId?: number | null;

  @ApiProperty({
    enum: AdminRole,
    required: false,
    description: 'Legacy role enum. Ignored if roleId is provided.',
  })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiProperty({
    required: false,
    description:
      'Dynamic role ID. If provided, takes precedence over the legacy role enum. Set to null to remove dynamic role.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  roleId?: number | null;
}
