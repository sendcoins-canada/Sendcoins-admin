import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { GetTransactionsDto } from '../transactions/dto/get-transactions.dto';
import { ActivityKind, GetActivityDto } from './dto/get-activity.dto';
import {
  ActivityItemDto,
  PaginatedActivityResponseDto,
} from './dto/activity-response.dto';

@Injectable()
export class ActivityService {
  // Per-source safety cap. The unified feed is built by fetching each source up
  // to this cap, normalizing, merging, then filtering/sorting/paginating in
  // memory — the same pattern TransactionsService.findAll already uses. Fine at
  // current scale (hundreds–thousands of rows); a DB UNION view is the upgrade
  // path if volume grows.
  private static readonly CAP = 2000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  async findAll(dto: GetActivityDto): Promise<PaginatedActivityResponseDto> {
    const { page = 1, limit = 20, kind = ActivityKind.ALL } = dto;

    // Only fetch a source when the caller isn't scoping to a different kind.
    const want = (k: ActivityKind) => kind === ActivityKind.ALL || kind === k;

    const [signups, kycEvents, txEvents, adminEvents] = await Promise.all([
      want(ActivityKind.SIGNUP) ? this.fetchSignups() : Promise.resolve([]),
      want(ActivityKind.KYC) ? this.fetchKycEvents() : Promise.resolve([]),
      want(ActivityKind.TRANSACTION)
        ? this.fetchTransactions()
        : Promise.resolve([]),
      want(ActivityKind.ADMIN_ACTION)
        ? this.fetchAdminActions()
        : Promise.resolve([]),
    ]);

    const merged: ActivityItemDto[] = [
      ...signups,
      ...kycEvents,
      ...txEvents,
      ...adminEvents,
    ];

    // ---- Uniform cross-source filtering ----
    const wantSearch = dto.search?.trim().toLowerCase();
    const fromMs = dto.dateFrom ? new Date(dto.dateFrom).getTime() : undefined;
    const toMs = dto.dateTo ? new Date(dto.dateTo).getTime() : undefined;

    const filtered = merged.filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      if (fromMs !== undefined && ts < fromMs) return false;
      if (toMs !== undefined && ts > toMs) return false;
      if (wantSearch) {
        const haystack = [
          item.title,
          item.description,
          item.actor,
          item.status,
          item.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(wantSearch)) return false;
      }
      return true;
    });

    // Newest first.
    filtered.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;
    const data = filtered.slice(skip, skip + limit);

    return {
      data,
      pagination: { page, limit, total, totalPages },
    };
  }

  // ---------------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------------

  /** New user registrations (consumer app users — same table the Users page reads). */
  private async fetchSignups(): Promise<ActivityItemDto[]> {
    const users = await this.prisma.client.send_coin_user.findMany({
      take: ActivityService.CAP,
      orderBy: { timestamp: 'desc' },
      select: {
        azer_id: true,
        first_name: true,
        last_name: true,
        user_email: true,
        country: true,
        verify_user: true,
        timestamp: true,
      },
    });

    return users.map((u) => {
      const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
      return {
        id: `signup-${u.azer_id}`,
        kind: ActivityKind.SIGNUP,
        title: 'New user signup',
        description: `${name || u.user_email || 'A user'} registered`,
        actor: u.user_email || name || undefined,
        status: u.verify_user ? 'verified' : 'pending',
        timestamp: new Date(u.timestamp).toISOString(),
        link: `/users?search=${encodeURIComponent(u.user_email || '')}`,
        metadata: { country: u.country ?? undefined },
      };
    });
  }

  /**
   * KYC verification events. MetaMap is the provider in use: verification state
   * lives on send_coin_user (metamap_verification_id / metamap_verification_status),
   * the same table the KYC Queue page reads. There is no dedicated verification
   * timestamp column, so we order by — and surface — the user's signup
   * `timestamp` as the best available event time. Raw SQL because these columns
   * aren't mapped in the admin Prisma schema (mirrors KycService's approach).
   */
  private async fetchKycEvents(): Promise<ActivityItemDto[]> {
    type KycRow = {
      azer_id: number;
      first_name: string | null;
      last_name: string | null;
      user_email: string | null;
      verify_user: boolean | null;
      metamap_verification_id: string | null;
      metamap_verification_status: string | null;
      timestamp: Date;
    };

    let rows: KycRow[] = [];
    try {
      rows = await this.prisma.client.$queryRawUnsafe<KycRow[]>(
        `SELECT azer_id, first_name, last_name, user_email, verify_user,
                metamap_verification_id, metamap_verification_status, timestamp
         FROM send_coin_user
         WHERE metamap_verification_id IS NOT NULL
         ORDER BY timestamp DESC
         LIMIT ${ActivityService.CAP}`,
      );
    } catch {
      return [];
    }

    return rows.map((u) => {
      const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
      const status = (u.metamap_verification_status ?? '').toLowerCase();
      const verified = status === 'verified' || !!u.verify_user;
      return {
        id: `kyc-${u.azer_id}`,
        kind: ActivityKind.KYC,
        title: verified ? 'KYC verified' : 'KYC submitted',
        description: `${name || u.user_email || 'A user'} — identity verification ${u.metamap_verification_status ?? 'submitted'}`,
        actor: u.user_email || name || undefined,
        status: u.metamap_verification_status ?? (verified ? 'verified' : 'pending'),
        timestamp: new Date(u.timestamp).toISOString(),
        link: `/kyc?search=${encodeURIComponent(u.user_email || '')}`,
        metadata: {
          verificationId: u.metamap_verification_id ?? undefined,
          provider: 'metamap',
        },
      };
    });
  }

  /** All transactions, sourced from the unified 6-source merge. */
  private async fetchTransactions(): Promise<ActivityItemDto[]> {
    const result = await this.transactions.findAll({
      page: 1,
      limit: ActivityService.CAP,
    } as GetTransactionsDto);

    return result.data.map((tx) => {
      const dir = tx.type; // INCOMING | OUTGOING | CONVERSION
      const title =
        dir === 'INCOMING'
          ? 'Incoming transaction'
          : dir === 'OUTGOING'
            ? 'Outgoing transaction'
            : 'Conversion';
      const when = tx.dateInitiated ?? tx.createdAt;
      return {
        id: `tx-${tx.reference || tx.txId || tx.id}`,
        kind: ActivityKind.TRANSACTION,
        title,
        description: tx.amount?.display || `${tx.currency?.display ?? ''}`.trim(),
        actor: tx.userEmail || tx.userName || tx.userApiKey || undefined,
        status: tx.status,
        amount: tx.amount
          ? {
              value: tx.amount.crypto ?? tx.amount.fiat ?? 0,
              currency: tx.currency?.crypto || tx.currency?.fiat || tx.currency?.display || '',
              display: tx.amount.display,
            }
          : undefined,
        timestamp: new Date(when).toISOString(),
        link: `/transactions?search=${encodeURIComponent(tx.reference || tx.txId || '')}`,
        metadata: { category: tx.transactionCategory, network: tx.network },
      };
    });
  }

  /** Admin-performed actions from the audit log. */
  private async fetchAdminActions(): Promise<ActivityItemDto[]> {
    const logs = await this.prisma.client.adminAuditLog.findMany({
      take: ActivityService.CAP,
      orderBy: { createdAt: 'desc' },
    });

    // Resolve admin ids -> emails in one query.
    const ids = Array.from(
      new Set(
        logs.flatMap((l) => [l.adminId, l.actorId].filter((v): v is number => v != null)),
      ),
    );
    const admins = ids.length
      ? await this.prisma.client.adminUser.findMany({
          where: { id: { in: ids } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const adminById = new Map(
      admins.map((a) => [
        a.id,
        `${a.firstName} ${a.lastName}`.trim() || a.email,
      ]),
    );

    return logs.map((log) => {
      const actorId = log.actorId ?? log.adminId ?? undefined;
      const actor = actorId != null ? adminById.get(actorId) : undefined;
      return {
        id: `audit-${log.id}`,
        kind: ActivityKind.ADMIN_ACTION,
        title: this.humanizeAction(log.action),
        description: this.describeDetail(log.action, log.detail, actor),
        actor,
        timestamp: new Date(log.createdAt).toISOString(),
        link: '/audit-logs',
        metadata: { ipAddress: log.ipAddress ?? undefined },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Turns ADMIN_LOGIN_FAILED into "Admin login failed". */
  private humanizeAction(action: string): string {
    const lower = action.replace(/_/g, ' ').toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  private describeDetail(
    action: string,
    detail: unknown,
    actor?: string,
  ): string {
    const who = actor ? `${actor}` : 'An admin';
    if (detail && typeof detail === 'object') {
      const d = detail as Record<string, unknown>;
      const ref =
        (d.transactionReference as string) ||
        (d.reference as string) ||
        (d.email as string) ||
        (d.target as string);
      if (ref) return `${who} — ${this.humanizeAction(action)} (${ref})`;
    }
    return `${who} performed ${this.humanizeAction(action).toLowerCase()}`;
  }
}
