import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDepartmentDto {
  @ApiProperty({
    description: 'Name of the department',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Optional description of the department',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
