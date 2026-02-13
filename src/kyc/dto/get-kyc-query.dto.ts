import { IsOptional, IsInt, IsString, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  ALL = 'all',
}

export class GetKycQueryDto {
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
    description: 'Filter by KYC status',
    required: false,
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(KycStatus)
  status?: KycStatus = KycStatus.PENDING;

  @ApiProperty({
    description: 'Search by email or name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by country',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;
}
