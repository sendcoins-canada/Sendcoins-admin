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
import { ConversionsService } from './conversions.service';
import {
  GetConversionsQueryDto,
  ConversionStatus,
} from './dto/get-conversions-query.dto';
import {
  ApproveConversionDto,
  RejectConversionDto,
} from './dto/conversion-action.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@ApiTags('Conversions')
@ApiBearerAuth()
@Controller('conversions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConversionsController {
  constructor(private readonly conversionsService: ConversionsService) {}

  @Get()
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get all conversions',
    description:
      'Returns a paginated list of crypto-to-fiat conversions. Requires VERIFY_TRANSACTIONS permission.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ConversionStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of conversions with pagination',
  })
  findAll(@Query() query: GetConversionsQueryDto) {
    return this.conversionsService.findAll(query);
  }

  @Get('stats')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get conversion statistics',
    description: 'Returns statistics about conversions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversion statistics',
  })
  getStats() {
    return this.conversionsService.getStats();
  }

  @Get(':id')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Get conversion by ID',
    description: 'Returns detailed information about a specific conversion.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Conversion ID' })
  @ApiResponse({
    status: 200,
    description: 'Conversion details',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversion not found',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.conversionsService.findOne(id);
  }

  @Post(':id/approve')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Approve conversion',
    description:
      'Approves a pending crypto-to-fiat conversion. Requires VERIFY_TRANSACTIONS permission.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Conversion ID' })
  @ApiBody({ type: ApproveConversionDto })
  @ApiResponse({
    status: 200,
    description: 'Conversion approved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversion not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Conversion is not pending',
  })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveConversionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.conversionsService.approve(id, req.user.id, dto.notes);
  }

  @Post(':id/reject')
  @RequirePermission(Permission.VERIFY_TRANSACTIONS)
  @ApiOperation({
    summary: 'Reject conversion',
    description:
      'Rejects a pending crypto-to-fiat conversion. Requires VERIFY_TRANSACTIONS permission.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Conversion ID' })
  @ApiBody({ type: RejectConversionDto })
  @ApiResponse({
    status: 200,
    description: 'Conversion rejected successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversion not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Conversion is not pending',
  })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectConversionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.conversionsService.reject(
      id,
      req.user.id,
      dto.reason,
      dto.notes,
    );
  }
}
