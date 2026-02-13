import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveConversionDto {
  @ApiProperty({
    description: 'Optional notes for the approval',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
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
