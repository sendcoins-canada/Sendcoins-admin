import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveConversionDto {
  @ApiProperty({
    description: 'Blockchain or payment transaction ID for this conversion',
    required: false,
    example: 'abc123def456...',
  })
  @IsOptional()
  @IsString()
  txHash?: string;

  @ApiProperty({
    description: 'Optional notes for the approval',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateConversionHashDto {
  @ApiProperty({
    description: 'Blockchain transaction hash to record for this conversion',
    example: 'abc123def456...',
  })
  @IsNotEmpty()
  @IsString()
  txHash!: string;
}

export class RejectConversionDto {
  @ApiProperty({
    description: 'Reason for rejecting the conversion',
    example: 'Suspicious activity detected',
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
