import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Tolerates both UPPERCASE (the values the API emits) and lowercase inputs for
 * the `kind` filter so the admin UI's tab filters never fail @IsEnum with a 400.
 */
const toUpperEnum = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

/**
 * The categories of platform events surfaced in the unified activity feed.
 * Each maps to a source-of-truth table (or, for TRANSACTION, the unified
 * 6-source transaction merge in TransactionsService).
 */
export enum ActivityKind {
  ALL = 'ALL',
  SIGNUP = 'SIGNUP',
  TRANSACTION = 'TRANSACTION',
  KYC = 'KYC',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

export class GetActivityDto {
  @ApiProperty({ required: false, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by event kind',
    enum: ActivityKind,
    required: false,
    default: ActivityKind.ALL,
  })
  @IsOptional()
  @Transform(toUpperEnum)
  @IsEnum(ActivityKind)
  kind?: ActivityKind = ActivityKind.ALL;

  @ApiProperty({
    description: 'Filter by date from (ISO 8601 format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter by date to (ISO 8601 format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Search by title, description, actor, or reference',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
