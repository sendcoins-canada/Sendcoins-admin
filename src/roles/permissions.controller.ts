import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ALL_PERMISSIONS, PERMISSION_METADATA } from '../auth/permissions.enum';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  @Get()
  @ApiOperation({
    summary: 'Get all available permissions',
    description:
      'Returns a list of all system permissions that can be assigned to roles. This endpoint is public and does not require authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all available permissions with metadata',
    schema: {
      type: 'object',
      properties: {
        permissions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              label: { type: 'string' },
              category: { type: 'string' },
            },
          },
        },
      },
    },
  })
  getAllPermissions() {
    return {
      permissions: ALL_PERMISSIONS.map((permission) => ({
        value: permission,
        ...PERMISSION_METADATA[permission],
      })),
    };
  }
}
