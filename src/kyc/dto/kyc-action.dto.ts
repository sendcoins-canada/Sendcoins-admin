import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApproveKycDto {
  @ApiProperty({
    description: 'Optional notes for the approval',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectKycDto {
  @ApiProperty({
    description: 'Reason for rejecting the KYC',
    example: 'Document unclear or expired',
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

export class RequestDocumentsDto {
  @ApiProperty({
    description: 'List of documents to request',
    example: ['ID document', 'Proof of address'],
    type: [String],
  })
  @IsNotEmpty()
  documents!: string[];

  @ApiProperty({
    description: 'Message to the user',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}
