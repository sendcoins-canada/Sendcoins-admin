import { IsArray, IsIP, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIpAllowlistDto {
  @ApiProperty({
    description:
      'Array of allowed IP addresses (IPv4 or IPv6). Empty array disables IP allowlist.',
    example: ['192.168.1.1', '10.0.0.1'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsIP(undefined, {
    each: true,
    message: 'Each IP must be a valid IPv4 or IPv6 address',
  })
  ips?: string[];
}
