import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  AdminNotificationType,
  AdminNotificationCategory,
} from '@prisma/client';

export class GetNotificationsDto {
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

  @ApiProperty({ enum: AdminNotificationType, required: false })
  @IsOptional()
  @IsEnum(AdminNotificationType)
  type?: AdminNotificationType;

  @ApiProperty({ enum: AdminNotificationCategory, required: false })
  @IsOptional()
  @IsEnum(AdminNotificationCategory)
  category?: AdminNotificationCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;
}
