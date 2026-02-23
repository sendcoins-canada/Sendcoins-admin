import { IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyActionMfaDto {
  @ApiProperty({
    description:
      '6-digit TOTP code from authenticator app or 8-digit backup code',
    minLength: 6,
    maxLength: 8,
  })
  @IsString()
  @Length(6, 8)
  code!: string;

  @ApiProperty({
    description: 'The action being performed (for audit logging)',
    required: false,
    example: 'APPROVE_TRANSACTION',
  })
  @IsString()
  @IsOptional()
  action?: string;
}
