import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'P@ssw0rd123!' })
  @IsString()
  @MinLength(8)
  password: string;
}


