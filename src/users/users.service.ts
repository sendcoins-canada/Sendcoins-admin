import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetUsersQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: Prisma.send_coin_userWhereInput = {};

    // Collect all filter conditions
    const conditions: Prisma.send_coin_userWhereInput[] = [];

    if (query.search) {
      const term = query.search.trim();
      conditions.push({
        OR: [
          { first_name: { contains: term, mode: 'insensitive' } },
          { last_name: { contains: term, mode: 'insensitive' } },
          { user_email: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    if (query.email) {
      conditions.push({
        user_email: {
          contains: query.email,
          mode: 'insensitive',
        },
      });
    }

    if (query.country) {
      // Make country filter case-insensitive and also check country_iso2
      // Use OR to match either country name or country_iso2 code
      conditions.push({
        OR: [
          {
            country: {
              contains: query.country,
              mode: 'insensitive',
            },
          },
          {
            country_iso2: {
              contains: query.country,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (query.accountBan !== undefined) {
      conditions.push({
        account_ban: query.accountBan,
      });
    }

    // Combine all conditions with AND
    if (conditions.length > 0) {
      if (conditions.length === 1) {
        Object.assign(where, conditions[0]);
      } else {
        where.AND = conditions;
      }
    }

    // Get total count for pagination
    const total = await this.prisma.client.send_coin_user.count({ where });

    // Fetch users with pagination
    const users = await this.prisma.client.send_coin_user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        // Include only safe fields, exclude sensitive data
        azer_id: true,
        first_name: true,
        last_name: true,
        user_email: true,
        verify_user: true,
        device: true,
        ip_addr: true,
        logincount: true,
        profession: true,
        offeredsolution: true,
        solutiontype: true,
        country: true,
        location: true,
        phone: true,
        device_security: true,
        activity_notify: true,
        default_currency: true,
        address: true,
        linkedin: true,
        facebook: true,
        twitter: true,
        instagram: true,
        github: true,
        profile_pix: true,
        webite: true,
        company_logo: true,
        company_name: true,
        company_verify: true,
        country_iso2: true,
        account_ban: true,
        timestamp: true,
        referal_id: true,
        referee: true,
        google_id: true,
        oauth_provider: true,
        apple_id: true,
        apple_verified: true,
        is_private_email: true,
        auth_provider: true,
        last_login_ip: true,
        last_login_location: true,
        last_login_at: true,
        // Exclude: password, live_secret_key, live_public_key, test_public_key, test_webhook_key, api_key
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      users: users.map((u) => ({
        ...u,
        signupPlatform: this.derivePlatform(u.device),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.client.send_coin_user.findUnique({
      where: { azer_id: id },
      select: {
        // Include only safe fields, exclude sensitive data
        azer_id: true,
        first_name: true,
        last_name: true,
        user_email: true,
        verify_user: true,
        device: true,
        ip_addr: true,
        logincount: true,
        profession: true,
        offeredsolution: true,
        solutiontype: true,
        country: true,
        location: true,
        phone: true,
        device_security: true,
        activity_notify: true,
        default_currency: true,
        address: true,
        linkedin: true,
        facebook: true,
        twitter: true,
        instagram: true,
        github: true,
        profile_pix: true,
        webite: true,
        company_logo: true,
        company_name: true,
        company_verify: true,
        country_iso2: true,
        account_ban: true,
        timestamp: true,
        referal_id: true,
        referee: true,
        google_id: true,
        oauth_provider: true,
        apple_id: true,
        apple_verified: true,
        is_private_email: true,
        auth_provider: true,
        last_login_ip: true,
        last_login_location: true,
        last_login_at: true,
        // Exclude: password, live_secret_key, live_public_key, test_public_key, test_webhook_key, api_key
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return { ...user, signupPlatform: this.derivePlatform(user.device) };
  }

  /**
   * Best-effort classification of the stored signup device string
   * (a raw user-agent) into a platform label for the admin UI.
   */
  private derivePlatform(device?: string | null): string | undefined {
    if (!device) return undefined;
    const d = device.toLowerCase();
    if (/iphone|ipad|ipod|ios|darwin/.test(d)) return 'iOS';
    if (/android|okhttp|dalvik/.test(d)) return 'Android';
    if (/mozilla|chrome|safari|firefox|edge|windows|macintosh|linux/.test(d))
      return 'Web';
    return 'Other';
  }

  async getStats() {
    const [total, suspended, verified] = await Promise.all([
      this.prisma.client.send_coin_user.count(),
      this.prisma.client.send_coin_user.count({
        where: { account_ban: 'true' },
      }),
      this.prisma.client.send_coin_user.count({
        where: { verify_user: true },
      }),
    ]);

    const active = total - suspended;
    const pendingKyc = total - verified;

    return {
      total,
      active,
      suspended,
      banned: suspended, // Using same value since account_ban covers both
      pendingKyc,
      verifiedKyc: verified,
    };
  }

  async suspendUser(id: number, reason?: string) {
    const user = await this.prisma.client.send_coin_user.findUnique({
      where: { azer_id: id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.account_ban === 'true') {
      throw new NotFoundException('User is already suspended');
    }

    await this.prisma.client.send_coin_user.update({
      where: { azer_id: id },
      data: { account_ban: 'true' },
    });

    return { success: true, message: 'User suspended successfully' };
  }

  async unsuspendUser(id: number) {
    const user = await this.prisma.client.send_coin_user.findUnique({
      where: { azer_id: id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.account_ban !== 'true') {
      throw new NotFoundException('User is not suspended');
    }

    await this.prisma.client.send_coin_user.update({
      where: { azer_id: id },
      data: { account_ban: 'false' },
    });

    return { success: true, message: 'User unsuspended successfully' };
  }

  async getActivity(id: number, page = 1, limit = 10) {
    const user = await this.prisma.client.send_coin_user.findUnique({
      where: { azer_id: id },
      select: {
        azer_id: true,
        api_key: true,
        last_login_at: true,
        last_login_ip: true,
        last_login_location: true,
        timestamp: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const activities: Array<{
      id: string;
      type: string;
      action: string;
      description: string;
      ip?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
      createdAt: string;
    }> = [];

    // Account creation
    if (user.timestamp) {
      activities.push({
        id: `${user.azer_id}-create`,
        type: 'PROFILE_UPDATE',
        action: 'Account Created',
        description: 'User account was created',
        createdAt: user.timestamp.toISOString(),
      });
    }

    // Last login
    if (user.last_login_at) {
      activities.push({
        id: `${user.azer_id}-login`,
        type: 'LOGIN',
        action: 'Login',
        description: `User logged in from ${user.last_login_location || 'Unknown location'}`,
        ip: user.last_login_ip || undefined,
        createdAt: user.last_login_at.toISOString(),
      });
    }

    // Real transaction activity, keyed by the user's api_key. Capped per
    // source — merged and paginated in memory (same pattern as ActivityService).
    // Sources: wallet_transfers, transaction_history (Prisma) +
    // fiat_bank_transfers (Prisma) + withdrawals, fiat_crypto_conversions,
    // crypto_fiat_conversions (raw SQL — tables may not exist yet).
    const CAP = 1000;
    if (user.api_key) {
      const [transfers, histories, fiatTransfers] = await Promise.all([
        this.prisma.client.wallet_transfers.findMany({
          where: { user_api_key: user.api_key },
          orderBy: { created_at: 'desc' },
          take: CAP,
        }),
        this.prisma.client.transaction_history.findMany({
          where: { user_api_key: user.api_key },
          orderBy: { created_at: 'desc' },
          take: CAP,
        }),
        this.prisma.client.fiat_bank_transfers.findMany({
          where: { user_api_key: user.api_key },
          orderBy: { created_at: 'desc' },
          take: CAP,
        }),
      ]);

      // --- wallet_transfers (crypto sends / receives) ---
      for (const t of transfers) {
        const meta = (t.metadata ?? {}) as Record<string, unknown>;
        const isReceive = meta.type === 'receive';
        activities.push({
          id: `transfer-${t.transfer_id}`,
          type: isReceive ? 'CRYPTO_RECEIVE' : 'CRYPTO_SEND',
          action: isReceive ? 'Crypto Received' : 'Crypto Sent',
          description: `${isReceive ? 'Received' : 'Sent'} ${Number(t.amount)} ${t.asset} (${t.status ?? 'pending'})`,
          ip: t.ip_address ?? undefined,
          userAgent: t.device ?? undefined,
          metadata: {
            reference: t.reference,
            status: t.status ?? undefined,
            network: t.network ?? undefined,
            txHash: t.tx_hash ?? undefined,
          },
          createdAt: new Date(Number(t.created_at) * 1000).toISOString(),
        });
      }

      // --- transaction_history (buy/sell via merchant) ---
      for (const h of histories) {
        const kind = (h.transaction_type ?? '').toLowerCase();
        const label =
          kind === 'buy' ? 'Bought' : kind === 'sell' ? 'Sold' : 'Converted';
        activities.push({
          id: `history-${h.history_id}`,
          type: 'TRANSACTION',
          action: `${label} ${h.crypto_sign ?? h.asset_type}`.trim(),
          description: `${label} ${h.crypto_amount ? Number(h.crypto_amount) : ''} ${h.crypto_sign ?? ''}${h.currency_amount ? ` for ${h.currency_sign ?? ''}${Number(h.currency_amount)}` : ''} (${h.status ?? 'pending'})`.replace(/\s+/g, ' '),
          ip: h.ip_address ?? undefined,
          userAgent: h.device ?? undefined,
          metadata: {
            reference: h.reference,
            status: h.status ?? undefined,
            network: h.network ?? undefined,
            txHash: h.tx_hash ?? undefined,
          },
          createdAt: new Date(Number(h.created_at) * 1000).toISOString(),
        });
      }

      // --- fiat_bank_transfers (bank payouts) ---
      for (const f of fiatTransfers) {
        activities.push({
          id: `fiat-${f.id}`,
          type: 'FIAT_TRANSFER',
          action: 'Bank Payout',
          description: `Sent ${Number(f.amount)} ${f.currency} to ${f.full_name} — ${f.bank_name} (${f.status ?? 'pending'})`,
          ip: f.ip_address ?? undefined,
          userAgent: f.device ?? undefined,
          metadata: {
            reference: f.reference,
            status: f.status ?? undefined,
            bankName: f.bank_name,
            accountNumber: f.account_number,
            country: f.destination_country,
          },
          createdAt: new Date(Number(f.created_at) * 1000).toISOString(),
        });
      }

      // --- withdrawals (crypto → NGN, raw SQL) ---
      try {
        type WithdrawalRow = {
          id: string; reference: string; source_asset: string;
          source_amount: string; ngn_amount: string; status: string;
          created_at: Date;
        };
        const withdrawals = await this.prisma.client.$queryRawUnsafe<WithdrawalRow[]>(
          `SELECT id, reference, source_asset, source_amount, ngn_amount, status, created_at
           FROM withdrawals WHERE user_api_key = $1 ORDER BY created_at DESC LIMIT $2`,
          user.api_key, CAP,
        );
        for (const wd of withdrawals) {
          activities.push({
            id: `withdrawal-${wd.id}`,
            type: 'WITHDRAWAL',
            action: 'Withdrawal',
            description: `Withdrew ${wd.source_amount} ${wd.source_asset} → ${wd.ngn_amount} NGN (${wd.status})`,
            metadata: { reference: wd.reference, status: wd.status },
            createdAt: new Date(wd.created_at).toISOString(),
          });
        }
      } catch { /* table may not exist yet */ }

      // --- fiat_crypto_conversions (fiat → crypto buy, raw SQL) ---
      try {
        type BuyRow = {
          conversion_id: number; reference: string; source_currency: string;
          source_amount: string; destination_asset: string; destination_amount: string;
          status: string; created_at_timestamp: Date | null;
        };
        const buys = await this.prisma.client.$queryRawUnsafe<BuyRow[]>(
          `SELECT conversion_id, reference, source_currency, source_amount,
                  destination_asset, destination_amount, status, created_at_timestamp
           FROM fiat_crypto_conversions WHERE user_api_key = $1 ORDER BY created_at DESC LIMIT $2`,
          user.api_key, CAP,
        );
        for (const buy of buys) {
          activities.push({
            id: `buy-${buy.conversion_id}`,
            type: 'FIAT_CRYPTO_BUY',
            action: 'Crypto Buy',
            description: `Bought ${buy.destination_amount} ${buy.destination_asset} with ${buy.source_amount} ${buy.source_currency} (${buy.status})`,
            metadata: { reference: buy.reference, status: buy.status },
            createdAt: buy.created_at_timestamp
              ? new Date(buy.created_at_timestamp).toISOString()
              : new Date().toISOString(),
          });
        }
      } catch { /* table may not exist yet */ }

      // --- crypto_fiat_conversions (crypto → fiat conversion, raw SQL) ---
      try {
        type ConvRow = {
          conversion_id: number; reference: string; source_asset: string;
          source_amount: string; destination_currency: string;
          final_fiat_amount: string; destination_amount: string;
          status: string; created_at_timestamp: Date | null;
        };
        const convs = await this.prisma.client.$queryRawUnsafe<ConvRow[]>(
          `SELECT conversion_id, reference, source_asset, source_amount,
                  destination_currency, final_fiat_amount, destination_amount,
                  status, created_at_timestamp
           FROM crypto_fiat_conversions WHERE user_api_key = $1 ORDER BY created_at DESC LIMIT $2`,
          user.api_key, CAP,
        );
        for (const conv of convs) {
          const fiatAmt = conv.final_fiat_amount || conv.destination_amount;
          activities.push({
            id: `conversion-${conv.conversion_id}`,
            type: 'CRYPTO_FIAT_CONVERSION',
            action: 'Crypto Conversion',
            description: `Converted ${conv.source_amount} ${conv.source_asset} → ${fiatAmt} ${conv.destination_currency} (${conv.status})`,
            metadata: { reference: conv.reference, status: conv.status },
            createdAt: conv.created_at_timestamp
              ? new Date(conv.created_at_timestamp).toISOString()
              : new Date().toISOString(),
          });
        }
      } catch { /* table may not exist yet */ }
    }

    // Sort by date descending
    activities.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Paginate
    const total = activities.length;
    const start = (page - 1) * limit;
    const data = activities.slice(start, start + limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
