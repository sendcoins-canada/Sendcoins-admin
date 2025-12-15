import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token received during login',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'The refresh token to revoke',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
