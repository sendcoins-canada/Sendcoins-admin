import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Input for previewing / crediting a campaign bonus.
 *
 * Recipients can be supplied three ways (checked in this order):
 *   - emails[]   : paste a list of emails (primary flow)
 *   - apiKeys[]  : from a bulk-select on the users table
 *   - segment    : a criteria bucket ('unverified' | 'verified' | 'all')
 */
export class CampaignBonusDto {
  @IsOptional()
  @IsString()
  campaign?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100) // guardrail against fat-fingering a large mass credit
  amount?: number;

  @IsOptional()
  @IsString()
  coin?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  apiKeys?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['unverified', 'verified', 'all'])
  segment?: 'unverified' | 'verified' | 'all';
}
