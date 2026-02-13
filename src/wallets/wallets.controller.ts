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
import { WalletsService } from './wallets.service';
import { GetWalletsQueryDto, CryptoType } from './dto/get-wallets-query.dto';
import { FreezeWalletDto, FreezeAllWalletsDto } from './dto/freeze-wallet.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions.enum';

interface AuthenticatedRequest {
  user: { id: number; email: string };
}

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @RequirePermission(Permission.READ_WALLETS)
  @ApiOperation({
    summary: 'Get all wallets',
    description:
      'Returns a paginated list of wallets across all cryptocurrencies or filtered by type. Requires READ_WALLETS permission.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'crypto', required: false, enum: CryptoType })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'address', required: false, type: String })
  @ApiQuery({
    name: 'frozen',
    required: false,
    type: String,
    enum: ['true', 'false'],
  })
  @ApiResponse({
    status: 200,
    description: 'List of wallets with pagination',
  })
  findAll(@Query() query: GetWalletsQueryDto) {
    return this.walletsService.findAll(query);
  }

  @Get('stats')
  @RequirePermission(Permission.READ_WALLETS)
  @ApiOperation({
    summary: 'Get wallet statistics',
    description:
      'Returns statistics about wallets across all cryptocurrencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet statistics by cryptocurrency',
  })
  getStats() {
    return this.walletsService.getWalletStats();
  }

  @Get('user/:userId')
  @RequirePermission(Permission.READ_WALLETS)
  @ApiOperation({
    summary: 'Get all wallets for a user',
    description: 'Returns all cryptocurrency wallets for a specific user.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID (azer_id)' })
  @ApiResponse({
    status: 200,
    description: 'User wallets',
  })
  getUserWallets(@Param('userId', ParseIntPipe) userId: number) {
    return this.walletsService.getUserWallets(userId);
  }

  @Post(':crypto/:walletId/freeze')
  @RequirePermission(Permission.FREEZE_WALLETS)
  @ApiOperation({
    summary: 'Freeze a wallet',
    description:
      'Freezes a specific cryptocurrency wallet. Requires FREEZE_WALLETS permission.',
  })
  @ApiParam({
    name: 'crypto',
    enum: CryptoType,
    description: 'Cryptocurrency type',
  })
  @ApiParam({ name: 'walletId', type: Number, description: 'Wallet ID' })
  @ApiBody({ type: FreezeWalletDto })
  @ApiResponse({
    status: 200,
    description: 'Wallet frozen successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  freezeWallet(
    @Param('crypto') crypto: CryptoType,
    @Param('walletId', ParseIntPipe) walletId: number,
    @Body() dto: FreezeWalletDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.walletsService.freezeWallet(
      crypto,
      walletId,
      dto.reason,
      req.user.id,
    );
  }

  @Post(':crypto/:walletId/unfreeze')
  @RequirePermission(Permission.FREEZE_WALLETS)
  @ApiOperation({
    summary: 'Unfreeze a wallet',
    description:
      'Unfreezes a specific cryptocurrency wallet. Requires FREEZE_WALLETS permission.',
  })
  @ApiParam({
    name: 'crypto',
    enum: CryptoType,
    description: 'Cryptocurrency type',
  })
  @ApiParam({ name: 'walletId', type: Number, description: 'Wallet ID' })
  @ApiResponse({
    status: 200,
    description: 'Wallet unfrozen successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  unfreezeWallet(
    @Param('crypto') crypto: CryptoType,
    @Param('walletId', ParseIntPipe) walletId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.walletsService.unfreezeWallet(crypto, walletId, req.user.id);
  }

  @Post('user/:userId/freeze-all')
  @RequirePermission(Permission.FREEZE_WALLETS)
  @ApiOperation({
    summary: 'Freeze all wallets for a user',
    description:
      'Freezes all cryptocurrency wallets for a specific user. Requires FREEZE_WALLETS permission.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID (azer_id)' })
  @ApiBody({ type: FreezeAllWalletsDto })
  @ApiResponse({
    status: 200,
    description: 'All user wallets frozen successfully',
  })
  freezeAllUserWallets(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: FreezeAllWalletsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.walletsService.freezeAllUserWallets(
      userId,
      dto.reason,
      req.user.id,
    );
  }

  @Post('user/:userId/unfreeze-all')
  @RequirePermission(Permission.FREEZE_WALLETS)
  @ApiOperation({
    summary: 'Unfreeze all wallets for a user',
    description:
      'Unfreezes all cryptocurrency wallets for a specific user. Requires FREEZE_WALLETS permission.',
  })
  @ApiParam({ name: 'userId', type: Number, description: 'User ID (azer_id)' })
  @ApiResponse({
    status: 200,
    description: 'All user wallets unfrozen successfully',
  })
  unfreezeAllUserWallets(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.walletsService.unfreezeAllUserWallets(userId, req.user.id);
  }
}
