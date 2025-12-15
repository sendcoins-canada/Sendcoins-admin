import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMfaDto {
  @ApiProperty({
    description: 'Temporary token from login step 1 (when MFA is enabled)',
  })
  @IsString()
  tempToken!: string;

  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    minLength: 6,
    maxLength: 8,
  })
  @IsString()
  @Length(6, 8)
  code!: string;
}
