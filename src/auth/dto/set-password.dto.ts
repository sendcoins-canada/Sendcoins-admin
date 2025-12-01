import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8, example: 'NewStr0ngP@ss!' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ minLength: 8, example: 'NewStr0ngP@ss!' })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}


