import { IsOptional, IsInt, IsString, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ConversionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ALL = 'all',
}

export class GetConversionsQueryDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page (max 100)',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by status',
    required: false,
    enum: ConversionStatus,
    default: ConversionStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ConversionStatus)
  status?: ConversionStatus = ConversionStatus.PENDING;

  @ApiProperty({
    description: 'Search by reference or email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by destination country',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;
}
