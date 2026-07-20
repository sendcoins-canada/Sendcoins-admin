import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * CrayFi NGN payouts view.
 *
 * These payouts live in the ACID `transactions` table (written by the Express
 * backend's transactionService), NOT in fiat_bank_transfers — so the normal
 * transactions aggregation never shows them. This service reads them directly
 * and surfaces CrayFi's real outcome (status + failure_reason), which is stored
 * in metadata.crayfiResponse. That is what makes a failure like PMN-13-422
 * visible in the admin, proving the failure is on CrayFi's side.
 *
 * The stored CrayFi status is kept fresh by scripts/reconcile-payouts.js.
 */
@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow(r: Record<string, any>) {
    const ourStatus = String(r.status || '').toLowerCase();
    const crayfiStatus = r.crayfi_status || null;
    const crayfiLc = String(crayfiStatus || '').toLowerCase();
    // The real outcome: prefer CrayFi's verdict when we have it.
    let effectiveStatus = ourStatus;
    if (['successful', 'success', 'completed'].includes(crayfiLc)) effectiveStatus = 'completed';
    else if (['failed', 'failure', 'reversed', 'declined'].includes(crayfiLc)) effectiveStatus = 'failed';
    else if (['pending', 'processing'].includes(crayfiLc)) effectiveStatus = 'pending';
    // Mismatch flag: we told the user "completed" but CrayFi did not succeed.
    const mismatch = ourStatus === 'completed' && crayfiStatus != null && effectiveStatus !== 'completed';
    return {
      id: r.id,
      userEmail: r.user_email || null,
      amount: r.amount != null ? Number(r.amount) : null,
      currency: r.currency || 'NGN',
      reference: r.reference || null,
      crayfiTransactionId: r.crayfi_transaction_id || null,
      ourStatus,
      crayfiStatus,
      effectiveStatus,
      failureReason: r.failure_reason || null,
      mismatch,
      refunded: r.refunded === true,
      recipient: {
        name: r.recipient_name || null,
        account: r.recipient_account || null,
        bank: r.recipient_bank || null,
      },
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };
  }

  async list(params: { limit?: number; offset?: number; status?: string } = {}) {
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
    const offset = Math.max(Number(params.offset) || 0, 0);
    const client = this.prisma.client;

    const rows = await client.$queryRawUnsafe<Record<string, any>[]>(
      `SELECT t.id, t.amount, t.currency, t.status, t.reference, t.crayfi_transaction_id,
              t.created_at, t.completed_at,
              t.metadata->'crayfiResponse'->>'status' AS crayfi_status,
              COALESCE(
                t.metadata->'crayfiResponse'->>'failureReason',
                t.metadata->'crayfiResponse'->'fullResponse'->>'failure_reason'
              ) AS failure_reason,
              t.metadata->'validation'->>'accountName' AS recipient_name,
              t.metadata->'validation'->>'accountNumber' AS recipient_account,
              t.metadata->'validation'->>'bankName' AS recipient_bank,
              (t.metadata->'refund') IS NOT NULL AS refunded,
              u.user_email
       FROM transactions t
       LEFT JOIN wallet_accounts wa ON wa.id = t.wallet_account_id
       LEFT JOIN wallets w ON w.id = wa.wallet_id
       LEFT JOIN send_coin_user u ON u.api_key = w.user_api_key
       WHERE t.metadata->'crayfiResponse' IS NOT NULL
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      limit,
      offset,
    );

    let data = rows.map((r) => this.mapRow(r));
    if (params.status) {
      const want = params.status.toLowerCase();
      data = data.filter((d) => d.effectiveStatus === want);
    }

    const countRows = await client.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM transactions WHERE metadata->'crayfiResponse' IS NOT NULL`,
    );
    const total = countRows.length ? Number(countRows[0].count) : data.length;

    return { data, total, limit, offset };
  }

  /** Summary counts by CrayFi's real outcome, plus how many are mislabeled. */
  async stats() {
    const client = this.prisma.client;
    const rows = await client.$queryRawUnsafe<Record<string, any>[]>(
      `SELECT
         LOWER(COALESCE(metadata->'crayfiResponse'->>'status','(none)')) AS crayfi_status,
         status AS our_status,
         COUNT(*)::bigint AS n,
         COALESCE(SUM(amount),0)::numeric AS total_amount
       FROM transactions
       WHERE metadata->'crayfiResponse' IS NOT NULL
       GROUP BY 1, 2`,
    );
    let delivered = 0, failed = 0, pending = 0, mislabeled = 0, mislabeledAmount = 0;
    for (const r of rows) {
      const n = Number(r.n);
      const cs = String(r.crayfi_status || '');
      const our = String(r.our_status || '').toLowerCase();
      const isSuccess = ['successful', 'success', 'completed'].includes(cs);
      const isFailed = ['failed', 'failure', 'reversed', 'declined'].includes(cs);
      const isPending = ['pending', 'processing'].includes(cs);
      if (isSuccess) delivered += n;
      else if (isFailed) failed += n;
      else if (isPending) pending += n;
      // "completed" to the user but CrayFi did not succeed → mislabeled (the bug's footprint)
      if (our === 'completed' && !isSuccess) {
        mislabeled += n;
        mislabeledAmount += Number(r.total_amount) || 0;
      }
    }
    return { delivered, failed, pending, mislabeled, mislabeledAmount };
  }
}
