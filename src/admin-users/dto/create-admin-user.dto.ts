import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { AdminRole } from '../../auth/roles.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Engineering', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.ENGINEER })
  @IsEnum(AdminRole)
  role: AdminRole;
}


