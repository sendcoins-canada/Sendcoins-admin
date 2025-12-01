import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePasswordTokenDto {
  @ApiProperty()
  @IsString()
  token: string;
}


