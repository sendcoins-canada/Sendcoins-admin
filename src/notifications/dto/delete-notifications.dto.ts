import { IsArray, IsInt, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteNotificationsDto {
  @ApiProperty({
    type: [Number],
    description: 'Array of notification IDs to delete',
    example: [1, 2, 3],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  notificationIds!: number[];
}
