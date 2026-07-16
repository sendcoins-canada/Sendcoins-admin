import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignBonusDto } from './dto/campaign-bonus.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MfaActionGuard } from '../auth/mfa-action.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RequireMfa } from '../auth/require-mfa.decorator';
import { Permission } from '../auth/permissions.enum';

@Controller('admin/campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard, MfaActionGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  /**
   * Dry-run: resolve recipients and show who will be credited / already
   * credited / not found. Read-only, no MFA.
   */
  @Post('bonus/preview')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  async preview(@Body() dto: CampaignBonusDto) {
    const data = await this.campaignsService.preview(dto);
    return { success: true, data };
  }

  /**
   * Credit the bonus to eligible recipients. Money-moving → MFA-gated
   * (enforced only for admins who have MFA enabled).
   */
  @Post('bonus/credit')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  @RequireMfa()
  async credit(
    @Body() dto: CampaignBonusDto,
    @Request() req: { user: { id: number } },
  ) {
    const data = await this.campaignsService.credit(dto, req.user.id);
    return { success: true, data };
  }

  /**
   * Totals for a campaign (how many credited, total amount).
   */
  @Get('bonus/stats')
  @RequirePermission(Permission.MANAGE_PLATFORM)
  async stats(@Query('campaign') campaign?: string) {
    const data = await this.campaignsService.stats(campaign);
    return { success: true, data };
  }
}
