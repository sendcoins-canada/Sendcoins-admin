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
  Query,
} from '@nestjs/common';
import { SettingsService, SystemSetting } from './settings.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MfaActionGuard } from '../auth/mfa-action.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RequireMfa } from '../auth/require-mfa.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard, MfaActionGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailService: MailService,
  ) {}

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
   * Get fee-related settings (platform fee %, etc.) for admin UI and for main backend to consume
   */
  @Get('fees')
  @RequirePermission(Permission.VIEW_ANALYTICS)
  async getFeeSettings(): Promise<{
    platformFeePercentage: number;
    platformFeePercentageKey: string;
  }> {
    const value = await this.settingsService.getSettingValue<number>(
      'platform_fee_percentage',
      1.2,
    );
    return {
      platformFeePercentage: typeof value === 'number' ? value : parseFloat(String(value)) || 1.2,
      platformFeePercentageKey: 'platform_fee_percentage',
    };
  }

  /**
   * Update fee settings (platform fee %). Creates the setting if it does not exist.
   */
  @Put('fees')
  @RequirePermission(Permission.MANAGE_ADMINS)
  @RequireMfa()
  async updateFeeSettings(
    @Body() body: { platformFeePercentage?: number },
    @Request() req: { user: { id: number } },
  ) {
    const platformFeePercentage = body.platformFeePercentage;
    if (
      typeof platformFeePercentage !== 'number' ||
      platformFeePercentage < 0 ||
      platformFeePercentage > 100
    ) {
      return { success: false, error: 'platformFeePercentage must be a number between 0 and 100' };
    }
    const key = 'platform_fee_percentage';
    let existing = await this.settingsService.getSetting(key);
    if (!existing) {
      await this.settingsService.createSetting(
        key,
        String(platformFeePercentage),
        'number',
        'Platform fee percentage for crypto-to-fiat conversions',
        req.user.id,
      );
    } else {
      await this.settingsService.updateSetting(
        key,
        String(platformFeePercentage),
        req.user.id,
      );
    }
    const updated = await this.settingsService.getSetting(key);
    return {
      success: true,
      platformFeePercentage: parseFloat(updated!.settingValue),
    };
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
  @RequireMfa()
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
  @RequireMfa()
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
  @RequireMfa()
  async deleteSetting(
    @Param('key') key: string,
    @Request() req: { user: { id: number } },
  ) {
    await this.settingsService.deleteSetting(key, req.user.id);
    return { success: true };
  }

  /**
   * Test email configuration - verify SMTP connection
   */
  @Get('mail/verify')
  @RequirePermission(Permission.MANAGE_ADMINS)
  async verifyMailConnection() {
    return this.mailService.verifyConnection();
  }

  /**
   * Test email configuration - send test email
   */
  @Post('mail/test')
  @RequirePermission(Permission.MANAGE_ADMINS)
  async sendTestEmail(@Query('email') email: string) {
    if (!email) {
      return { success: false, error: 'Email parameter is required' };
    }
    return this.mailService.sendTestEmail(email);
  }
}
