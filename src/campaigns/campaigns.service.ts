import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CampaignBonusDto } from './dto/campaign-bonus.dto';

interface TargetUser {
  api_key: string | null;
  user_email: string | null;
  verify_user: boolean | null;
  first_name: string | null;
}

interface PlanRow {
  email: string | null;
  firstName: string | null;
  apiKey: string | null;
  verified: boolean;
  hasWallet: boolean;
  walletId: number | null;
  alreadyCredited: boolean;
  willCredit: boolean;
}

/**
 * Campaign bonus crediting.
 *
 * A bonus is a DB ledger credit to azer_usdt_wallet.total_balance (no on-chain
 * tx), recorded idempotently in send_coin_campaign_bonus (UNIQUE(user_api_key,
 * campaign)). Users without a USDT wallet get an address-less trc20 row — the
 * user app displays total_balance for such rows and fills the address later.
 * Mirrors scripts/credit-campaign-bonus.js in the Express backend.
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  private readonly DEFAULT_CAMPAIGN = 'welcome-5usdt-2026-07';
  private readonly DEFAULT_AMOUNT = 5;
  private readonly DEFAULT_COIN = 'usdt';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private normalizeEmails(emails?: string[]): string[] {
    if (!emails) return [];
    return [
      ...new Set(
        emails
          .map((e) => (e || '').trim().toLowerCase())
          .filter((e) => e.includes('@')),
      ),
    ];
  }

  private async resolveTargets(dto: CampaignBonusDto): Promise<{
    users: TargetUser[];
    requestedEmails: string[];
  }> {
    const client = this.prisma.client;

    if (dto.apiKeys?.length) {
      const users = await client.$queryRawUnsafe<TargetUser[]>(
        `SELECT api_key, user_email, verify_user, first_name FROM send_coin_user WHERE api_key = ANY($1)`,
        dto.apiKeys,
      );
      return { users, requestedEmails: [] };
    }

    if (dto.emails?.length) {
      const requestedEmails = this.normalizeEmails(dto.emails);
      const users = requestedEmails.length
        ? await client.$queryRawUnsafe<TargetUser[]>(
            `SELECT api_key, user_email, verify_user, first_name FROM send_coin_user WHERE LOWER(user_email) = ANY($1)`,
            requestedEmails,
          )
        : [];
      return { users, requestedEmails };
    }

    if (dto.segment === 'unverified') {
      const users = await client.$queryRawUnsafe<TargetUser[]>(
        `SELECT api_key, user_email, verify_user, first_name FROM send_coin_user
         WHERE (verify_user IS NULL OR verify_user = false)
           AND account_ban = 'false' AND user_email IS NOT NULL`,
      );
      return { users, requestedEmails: [] };
    }

    if (dto.segment === 'verified') {
      const users = await client.$queryRawUnsafe<TargetUser[]>(
        `SELECT api_key, user_email, verify_user, first_name FROM send_coin_user
         WHERE verify_user = true AND account_ban = 'false' AND user_email IS NOT NULL`,
      );
      return { users, requestedEmails: [] };
    }

    if (dto.segment === 'all') {
      const users = await client.$queryRawUnsafe<TargetUser[]>(
        `SELECT api_key, user_email, verify_user, first_name FROM send_coin_user
         WHERE account_ban = 'false' AND user_email IS NOT NULL`,
      );
      return { users, requestedEmails: [] };
    }

    return { users: [], requestedEmails: [] };
  }

  private async buildPlan(
    users: TargetUser[],
    campaign: string,
  ): Promise<PlanRow[]> {
    const client = this.prisma.client;
    const apiKeys = users
      .map((u) => u.api_key)
      .filter((k): k is string => !!k);

    let creditedSet = new Set<string>();
    const walletMap = new Map<string, number>(); // api_key -> target wallet_id (prefer trc20)

    if (apiKeys.length) {
      const creditedRows = await client.$queryRawUnsafe<
        { user_api_key: string }[]
      >(
        `SELECT user_api_key FROM send_coin_campaign_bonus WHERE campaign = $1 AND user_api_key = ANY($2)`,
        campaign,
        apiKeys,
      );
      creditedSet = new Set(creditedRows.map((r) => r.user_api_key));

      // One target wallet per user, preferring trc20 (matches the CLI script),
      // so users with multiple USDT wallet rows (bep20/erc20/trc20) are credited
      // exactly once, not on every row.
      const walletRows = await client.$queryRawUnsafe<
        { user_api_key: string; wallet_id: number }[]
      >(
        `SELECT DISTINCT ON (user_api_key) user_api_key, wallet_id
         FROM azer_usdt_wallet
         WHERE user_api_key = ANY($1)
         ORDER BY user_api_key, CASE WHEN network = 'trc20' THEN 0 ELSE 1 END, wallet_id`,
        apiKeys,
      );
      for (const w of walletRows) walletMap.set(w.user_api_key, w.wallet_id);
    }

    return users.map((u) => {
      const apiKey = u.api_key;
      const alreadyCredited = !!apiKey && creditedSet.has(apiKey);
      const walletId = apiKey ? (walletMap.get(apiKey) ?? null) : null;
      return {
        email: u.user_email,
        firstName: u.first_name,
        apiKey,
        verified: u.verify_user === true,
        hasWallet: walletId !== null,
        walletId,
        alreadyCredited,
        willCredit: !!apiKey && !alreadyCredited,
      };
    });
  }

  async preview(dto: CampaignBonusDto) {
    const campaign = dto.campaign || this.DEFAULT_CAMPAIGN;
    const amount = dto.amount ?? this.DEFAULT_AMOUNT;
    const coin = dto.coin || this.DEFAULT_COIN;

    const { users, requestedEmails } = await this.resolveTargets(dto);
    const plan = await this.buildPlan(users, campaign);

    const foundEmails = new Set(
      users.map((u) => (u.user_email || '').toLowerCase()),
    );
    const notFound = requestedEmails.filter((e) => !foundEmails.has(e));

    return {
      campaign,
      amount,
      coin,
      willCreditCount: plan.filter((p) => p.willCredit).length,
      alreadyCreditedCount: plan.filter((p) => p.alreadyCredited).length,
      notFoundCount: notFound.length,
      notFound,
      plan: plan.map((p) => ({
        email: p.email,
        verified: p.verified,
        hasWallet: p.hasWallet,
        status: p.alreadyCredited
          ? 'already_credited'
          : p.willCredit
            ? 'will_credit'
            : 'ineligible',
      })),
    };
  }

  async credit(dto: CampaignBonusDto, adminId: number) {
    const campaign = dto.campaign || this.DEFAULT_CAMPAIGN;
    const amount = dto.amount ?? this.DEFAULT_AMOUNT;
    const coin = dto.coin || this.DEFAULT_COIN;
    const client = this.prisma.client;

    const { users, requestedEmails } = await this.resolveTargets(dto);
    const plan = await this.buildPlan(users, campaign);
    const toCredit = plan.filter((p) => p.willCredit && p.apiKey);

    const foundEmails = new Set(
      users.map((u) => (u.user_email || '').toLowerCase()),
    );
    const notFound = requestedEmails.filter((e) => !foundEmails.has(e));

    let credited = 0;
    const failed: string[] = [];

    for (const t of toCredit) {
      try {
        const didCredit = await client.$transaction(async (tx) => {
          // Idempotency marker first — ON CONFLICT DO NOTHING returns 0 rows if
          // this user was already credited (guards against a concurrent run).
          const inserted = await tx.$executeRawUnsafe(
            `INSERT INTO send_coin_campaign_bonus
               (user_api_key, user_email, campaign, amount, coin, wallet_created, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (user_api_key, campaign) DO NOTHING`,
            t.apiKey,
            t.email,
            campaign,
            amount,
            coin,
            !t.hasWallet,
          );
          if (inserted === 0) return false; // already credited — skip the balance move

          if (t.hasWallet && t.walletId !== null) {
            await tx.$executeRawUnsafe(
              `UPDATE azer_usdt_wallet SET total_balance = COALESCE(total_balance, 0) + $1 WHERE wallet_id = $2`,
              amount,
              t.walletId,
            );
          } else {
            await tx.$executeRawUnsafe(
              `INSERT INTO azer_usdt_wallet (user_api_key, network, name, total_balance, created_at)
               VALUES ($1, 'trc20', 'USDT Wallet', $2, $3)`,
              t.apiKey,
              amount,
              new Date().toISOString(),
            );
          }
          return true;
        });

        if (didCredit) {
          credited++;
          // Notify the recipient by email — best-effort, never fails the credit.
          await this.sendBonusEmail(t, amount, coin);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[campaign:${campaign}] credit failed for ${t.email}: ${message}`,
        );
        failed.push(t.email || t.apiKey || 'unknown');
      }
    }

    this.logger.log(
      `[campaign:${campaign}] admin ${adminId} credited ${credited}/${toCredit.length} (${amount} ${coin}); skipped ${plan.length - toCredit.length}, notFound ${notFound.length}, failed ${failed.length}`,
    );

    return {
      campaign,
      amount,
      coin,
      credited,
      skippedAlreadyCredited: plan.filter((p) => p.alreadyCredited).length,
      notFoundCount: notFound.length,
      notFound,
      failedCount: failed.length,
      failed,
      total: plan.length,
    };
  }

  /**
   * Notify a credited user by email. Best-effort — swallows its own errors so a
   * mail failure never affects the (already-committed) credit.
   */
  private async sendBonusEmail(t: PlanRow, amount: number, coin: string) {
    if (!t.email) return;
    const asset = coin.toUpperCase();
    try {
      await this.mailService.sendCustomEmail({
        to: [t.email],
        subject: `🎉 You've received a ${amount} ${asset} bonus`,
        html: this.buildBonusEmailHtml(t.firstName, amount, asset, t.verified),
        fromName: 'Sendcoins',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[campaign] bonus email failed for ${t.email}: ${message}`);
    }
  }

  private buildBonusEmailHtml(
    firstName: string | null,
    amount: number,
    asset: string,
    verified: boolean,
  ): string {
    const hi = firstName ? `Hi ${firstName},` : 'Hi there,';
    const unlockLine = verified
      ? `It's already in your wallet and ready to use.`
      : `Complete your identity verification (KYC) to unlock it — then you can send, convert, or withdraw it.`;
    const cta = verified ? 'Open your wallet' : 'Verify your account';
    return `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
        <div style="text-align:center;padding:28px 20px;background:linear-gradient(135deg,#E9FBEF,#DCF7E6);border-radius:16px;border:1px solid #A7E9BE;">
          <div style="font-size:40px;line-height:1;">🎉</div>
          <h1 style="margin:12px 0 4px;font-size:22px;color:#065F32;">You've received a ${amount} ${asset} bonus!</h1>
          <p style="margin:0;color:#0A7C43;font-size:14px;">A little something from the Sendcoins team.</p>
        </div>
        <p style="margin:24px 0 8px;font-size:15px;">${hi}</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">
          We've credited <strong>${amount} ${asset}</strong> to your Sendcoins account. ${unlockLine}
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://sendcoins.ca" style="display:inline-block;background:#12B76A;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">${cta}</a>
        </div>
        <p style="margin:0;color:#6B7280;font-size:12px;line-height:1.6;">
          If you weren't expecting this, you can safely ignore this email.
        </p>
      </div>`;
  }

  async stats(campaign?: string) {
    const target = campaign || this.DEFAULT_CAMPAIGN;
    const rows = await this.prisma.client.$queryRawUnsafe<
      { count: number; total_amount: number }[]
    >(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS total_amount
       FROM send_coin_campaign_bonus WHERE campaign = $1`,
      target,
    );
    const row = rows[0] || { count: 0, total_amount: 0 };
    return {
      campaign: target,
      credited: Number(row.count),
      totalAmount: Number(row.total_amount),
    };
  }
}
