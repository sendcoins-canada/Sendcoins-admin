import { ApiProperty } from '@nestjs/swagger';
import { ActivityKind } from './get-activity.dto';

export class ActivityAmountDto {
  @ApiProperty()
  value!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  display!: string;
}

export class ActivityItemDto {
  @ApiProperty({ description: 'Stable id, unique across sources (e.g. "tx-REF123")' })
  id!: string;

  @ApiProperty({ enum: ActivityKind })
  kind!: Exclude<ActivityKind, ActivityKind.ALL>;

  @ApiProperty({ description: 'Short headline, e.g. "New merchant signup"' })
  title!: string;

  @ApiProperty({ description: 'Human-readable detail line' })
  description!: string;

  @ApiProperty({ required: false, description: 'Who the event is about (merchant name/email or admin email)' })
  actor?: string;

  @ApiProperty({ required: false, description: 'Lifecycle status when applicable (transactions, KYC)' })
  status?: string;

  @ApiProperty({ type: ActivityAmountDto, required: false })
  amount?: ActivityAmountDto;

  @ApiProperty({ description: 'ISO 8601 timestamp the event occurred' })
  timestamp!: string;

  @ApiProperty({ required: false, description: 'Frontend deep link for the related record' })
  link?: string;

  @ApiProperty({ type: Object, required: false })
  metadata?: Record<string, unknown>;
}

export class PaginatedActivityResponseDto {
  @ApiProperty({ type: [ActivityItemDto] })
  data!: ActivityItemDto[];

  @ApiProperty({ type: Object })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
