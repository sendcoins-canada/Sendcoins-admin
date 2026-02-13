import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { GetKycQueryDto, KycStatus } from './dto/get-kyc-query.dto';
import { ApproveKycDto, RejectKycDto } from './dto/kyc-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  @RequirePermission(Permission.VERIFY_KYC)
  @ApiOperation({
    summary: 'Get KYC submissions',
    description:
      'Returns a paginated list of users with their KYC status. Requires VERIFY_KYC permission.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: KycStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of KYC submissions with pagination',
  })
  findAll(@Query() query: GetKycQueryDto) {
    return this.kycService.findAll(query);
  }

  @Get('stats')
  @RequirePermission(Permission.VERIFY_KYC)
  @ApiOperation({
    summary: 'Get KYC statistics',
    description: 'Returns statistics about KYC verification status.',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC statistics',
  })
  getStats() {
    return this.kycService.getKycStats();
  }

  @Get(':userId')
  @RequirePermission(Permission.VERIFY_KYC)
  @ApiOperation({
    summary: 'Get KYC details for a user',
    description: 'Returns detailed KYC information for a specific user.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID (azer_id)' })
  @ApiResponse({
    status: 200,
    description: 'User KYC details',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  getKycDetails(@Param('userId', ParseIntPipe) userId: number) {
    return this.kycService.getKycDetails(userId);
  }

  @Post(':userId/approve')
  @RequirePermission(Permission.VERIFY_KYC)
  @ApiOperation({
    summary: 'Approve KYC',
    description:
      'Approves KYC verification for a user. Requires VERIFY_KYC permission.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID (azer_id)' })
  @ApiBody({ type: ApproveKycDto })
  @ApiResponse({
    status: 200,
    description: 'KYC approved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  approveKyc(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ApproveKycDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.kycService.approveKyc(userId, req.user.id, dto.notes);
  }

  @Post(':userId/reject')
  @RequirePermission(Permission.VERIFY_KYC)
  @ApiOperation({
    summary: 'Reject KYC',
    description:
      'Rejects KYC verification for a user. Requires VERIFY_KYC permission.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID (azer_id)' })
  @ApiBody({ type: RejectKycDto })
  @ApiResponse({
    status: 200,
    description: 'KYC rejected successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  rejectKyc(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: RejectKycDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.kycService.rejectKyc(
      userId,
      req.user.id,
      dto.reason,
      dto.notes,
    );
  }
}
