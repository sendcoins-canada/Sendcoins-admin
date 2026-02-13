import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FreezeWalletDto {
  @ApiProperty({
    description: 'Reason for freezing the wallet',
    example: 'Suspicious activity detected',
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

export class FreezeAllWalletsDto {
  @ApiProperty({
    description: 'Reason for freezing all wallets',
    example: 'Account under investigation',
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
