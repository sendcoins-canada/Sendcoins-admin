import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SettingsService, SystemSetting } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get all system settings
   */
  @Get()
  @RequirePermission(Permission.VIEW_ANALYTICS)
  async getAllSettings(): Promise<{ settings: SystemSetting[] }> {
    const settings = await this.settingsService.getAllSettings();
    return { settings };
  }

  /**
   * Get a single setting by key
   */
  @Get(':key')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  async getSetting(@Param('key') key: string) {
    const setting = await this.settingsService.getSetting(key);
    if (!setting) {
      return { error: 'Setting not found' };
    }
    return setting;
  }

  /**
   * Update a system setting
   */
  @Put(':key')
  @RequirePermission(Permission.MANAGE_ADMINS)
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string },
    @Request() req: { user: { id: number } },
  ) {
    const setting = await this.settingsService.updateSetting(
      key,
      body.value,
      req.user.id,
    );
    return { success: true, setting };
  }

  /**
   * Create a new system setting
   */
  @Post()
  @RequirePermission(Permission.MANAGE_ADMINS)
  async createSetting(
    @Body()
    body: {
      key: string;
      value: string;
      type: SystemSetting['settingType'];
      description: string;
    },
    @Request() req: { user: { id: number } },
  ) {
    const setting = await this.settingsService.createSetting(
      body.key,
      body.value,
      body.type,
      body.description,
      req.user.id,
    );
    return { success: true, setting };
  }

  /**
   * Delete a system setting
   */
  @Delete(':key')
  @RequirePermission(Permission.MANAGE_ADMINS)
  async deleteSetting(
    @Param('key') key: string,
    @Request() req: { user: { id: number } },
  ) {
    await this.settingsService.deleteSetting(key, req.user.id);
    return { success: true };
  }
}
