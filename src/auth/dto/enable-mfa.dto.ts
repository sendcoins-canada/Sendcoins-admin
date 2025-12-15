import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableMfaDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app to verify setup',
    minLength: 6,
    maxLength: 8,
  })
  @IsString()
  @Length(6, 8)
  code!: string;
}
