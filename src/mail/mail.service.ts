import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const ZEPTO_API_TOKEN =
  process.env.ZEPTO_API_KEY ??
  process.env.ZEPTO_PASS ??
  'wSsVR60j8kXwDqt5mGGrdbhqn14HUlv0FEt/2QOo6napF/2X9cc/kk2YB1X1TvBKFmVvQTJDrL0ryh4E0DYI3Y8rmwkDACiF9mqRe1U4J3x17qnvhDzKVmRalReOL4kMxQ1okmVhF8kn+g==';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: nodemailer.Transporter;
  private fallbackTransporter!: nodemailer.Transporter;
  private hasZeptoCreds = false;

  onModuleInit() {
    this.hasZeptoCreds = Boolean(ZEPTO_API_TOKEN);
    this.logger.log(
      `Initializing mail service: Zepto REST API primary, Gmail SMTP fallback (zepto=${this.hasZeptoCreds})`,
    );

    // Dummy transporter only used when Zepto API and fallback both fail (e.g. for verify)
    this.transporter = nodemailer.createTransport({
      host: 'smtp.zeptomail.com',
      port: 587,
      secure: false,
      auth: { user: 'emailapikey', pass: ZEPTO_API_TOKEN },
    });

    // Create fallback transporter (Gmail SMTP)
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpMail = process.env.SMTP_MAIL;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (smtpMail && smtpPassword) {
      this.fallbackTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: 465,
        secure: true,
        auth: {
          user: smtpMail,
          pass: smtpPassword,
        },
      });
      this.logger.log('Fallback Gmail SMTP transporter initialized');
    } else {
      this.logger.warn(
        'SMTP_MAIL or SMTP_PASSWORD not set. Fallback email will not be available.',
      );
    }
  }

  async send(options: nodemailer.SendMailOptions): Promise<boolean> {
    this.logger.log(
      `[send] to=${JSON.stringify(options.to)} from=${JSON.stringify(options.from)} subject=${options.subject}`,
    );

    // 1) Try Zepto REST API first (bypasses SMTP 535 issues)
    if (this.hasZeptoCreds) {
      this.logger.log('[send] Trying Zepto REST API first');
      const apiOk = await this.sendViaZeptoApi(options);
      if (apiOk) return true;
      this.logger.warn('[send] Zepto API did not succeed, will try fallback');
    } else {
      this.logger.log('[send] Zepto creds not set, skipping API');
    }

    // 2) Fallback to Gmail SMTP
    this.logger.log('[send] Attempting fallback via Gmail SMTP');
    return this.sendViaFallback(options);
  }

  /**
   * Send via Zepto Mail REST API (same token as SMTP; often works when SMTP returns 535)
   */
  private async sendViaZeptoApi(options: nodemailer.SendMailOptions): Promise<boolean> {
    this.logger.log(`[Zepto API] parseFrom input type=${typeof options.from} value=${JSON.stringify(options.from)}`);
    const from = this.parseFrom(options.from);
    this.logger.log(`[Zepto API] parseTo input type=${typeof options.to} value=${JSON.stringify(options.to)}`);
    const toList = this.parseTo(options.to);

    this.logger.log(
      `[Zepto API] parsed from=${from ? `${from.name}<${from.address}>` : 'null'}, toCount=${toList.length}, toAddresses=[${toList.map((t) => t.address).join(', ')}]`,
    );

    if (!from || toList.length === 0) {
      this.logger.warn(`[Zepto API] invalid from/to (from=${!!from}, toCount=${toList.length})`);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toPayload = toList
      .filter((e) => e.address && emailRegex.test(e.address))
      .map((e) => ({
        email_address: {
          address: e.address,
          name: e.name && e.name.trim() ? e.name : e.address,
        },
      }));

    this.logger.log(`[Zepto API] toPayload length=${toPayload.length}, first=${toPayload[0] ? JSON.stringify(toPayload[0]) : 'none'}`);

    if (toPayload.length === 0) {
      this.logger.warn('[Zepto API] no valid recipient addresses after filter');
      return false;
    }

    const body: Record<string, unknown> = {
      from: { address: from.address, name: from.name },
      to: toPayload,
      subject: String(options.subject ?? ''),
    };
    if (options.html) body.htmlbody = options.html;
    if (options.text) body.textbody = options.text;
    if (!body.htmlbody && !body.textbody) body.textbody = '';
    const ccList = this.parseTo(options.cc);
    if (ccList.length > 0) {
      body.cc = ccList.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.address)).map((e) => ({ email_address: { address: e.address, name: e.name || e.address } }));
    }
    const bccList = this.parseTo(options.bcc);
    if (bccList.length > 0) {
      body.bcc = bccList.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.address)).map((e) => ({ email_address: { address: e.address, name: e.name || e.address } }));
    }

    this.logger.log(
      `[Zepto API] request body keys: ${Object.keys(body).join(', ')}, bodyLength=${JSON.stringify(body).length}`,
    );

    try {
      this.logger.log('[Zepto API] POST https://api.zeptomail.com/v1.1/email');
      const res = await fetch('https://api.zeptomail.com/v1.1/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Zoho-enczapikey ${ZEPTO_API_TOKEN}`,
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { request_id?: string; message?: string; error?: { message?: string } };
      this.logger.log(`[Zepto API] response status=${res.status}, ok=${res.ok}`);

      if (res.ok) {
        this.logger.log(`[Zepto API] success request_id=${data.request_id ?? 'n/a'}`);
        return true;
      }
      this.logger.error(`[Zepto API] failed status=${res.status} body=${JSON.stringify(data)}`);
      const errDetails = (data as { error?: { details?: Array<{ code?: string; message?: string }> } })?.error?.details;
      if (res.status === 422 && errDetails?.some((d) => d?.code === 'LE_101' || d?.message?.toLowerCase().includes('credit'))) {
        this.logger.warn('[Zepto API] Credits expired or exhausted. Add credits in Zepto Mail dashboard or use Gmail fallback.');
      }
      return false;
    } catch (err) {
      const e = err as Error;
      this.logger.error(`[Zepto API] exception: ${e.message} ${e.stack ?? ''}`);
      return false;
    }
  }

  private parseFrom(from: nodemailer.SendMailOptions['from']): { address: string; name: string } | null {
    if (!from) return null;
    if (typeof from === 'string') {
      const s = from.replace(/\\"/g, '').trim();
      const angle = s.match(/<([^>]+)>$/);
      const address = angle ? angle[1].trim() : s;
      const namePart = angle ? s.slice(0, s.indexOf('<')).replace(/^["\s]+|["\s]+$/g, '').trim() : '';
      if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null;
      return { address, name: namePart || 'SendCoins' };
    }
    if (Array.isArray(from) && from[0]) {
      const e = from[0] as { address: string; name?: string };
      return { address: e.address, name: e.name ?? 'SendCoins' };
    }
    return null;
  }

  private parseTo(to: nodemailer.SendMailOptions['to']): Array<{ address: string; name: string }> {
    if (to == null || to === '') return [];
    const list = Array.isArray(to) ? to : [String(to)];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const out: Array<{ address: string; name: string }> = [];
    for (const e of list) {
      if (typeof e === 'string') {
        const s = e.replace(/\\"/g, '').trim();
        const angle = s.match(/<([^>]+)>$/);
        const address = angle ? angle[1].trim() : s;
        const namePart = angle
          ? s.slice(0, s.indexOf('<')).replace(/^["\s]+|["\s]+$/g, '').trim()
          : '';
        if (address && emailRegex.test(address)) {
          out.push({ address, name: namePart || address });
        }
      } else {
        const o = e as { address?: string; name?: string };
        const addr = (o?.address ?? '').trim();
        if (addr && emailRegex.test(addr)) {
          out.push({ address: addr, name: (o?.name ?? '').trim() || addr });
        }
      }
    }
    return out;
  }

  private async sendViaFallback(options: nodemailer.SendMailOptions): Promise<boolean> {
    if (!this.fallbackTransporter) {
      this.logger.error('[fallback] Transporter not initialized (SMTP_MAIL/SMTP_PASSWORD not set)');
      return false;
    }

    this.logger.log(`[fallback] Sending via Gmail SMTP to=${options.to} from=${process.env.SMTP_MAIL ?? 'env not set'}`);
    try {
      const fallbackOptions = {
        ...options,
        from: process.env.SMTP_MAIL,
      };

      const info = await this.fallbackTransporter.sendMail(fallbackOptions);
      this.logger.log(
        `[fallback] success messageId=${info.messageId} response=${info.response ?? 'n/a'}`,
      );
      return true;
    } catch (fallbackError) {
      const fallbackErr = fallbackError as Error & { code?: string; response?: string };
      this.logger.error(
        `[fallback] failed to=${options.to}: ${fallbackErr.message}`,
        fallbackErr.stack,
      );
      if (fallbackErr.code) this.logger.error(`[fallback] code=${fallbackErr.code}`);
      if (fallbackErr.response) this.logger.error(`[fallback] response=${fallbackErr.response}`);
      if (fallbackErr.code === 'EAUTH' || (fallbackErr.response && String(fallbackErr.response).includes('535'))) {
        this.logger.warn(
          '[fallback] Gmail SMTP auth failed. Use an App Password (not your normal password): Google Account → Security → 2-Step Verification → App passwords. Set SMTP_PASSWORD to that 16-character password.',
        );
      }
      return false;
    }
  }

  async sendAdminPasswordSetupLink(
    email: string,
    token: string,
    firstName?: string,
  ): Promise<boolean> {
    const name = firstName ?? 'there';
    const frontendUrl =
      process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:5713';
    const url = `${frontendUrl.replace(/\/$/, '')}/set-password?token=${encodeURIComponent(
      token,
    )}`;

    this.logger.log(`[Password setup] Link for ${email} (copy if mail not working): ${url}`);

    return this.send({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Set your SendCoins admin password',
      text: `Hi ${name},

Your SendCoins admin account has been created.

Please click the link below to set your password:
${url}

If you did not expect this email, you can ignore it.

Best,
SendCoins Team`,
    });
  }

  async sendAdminPasswordResetLink(
    email: string,
    token: string,
    firstName?: string,
  ): Promise<boolean> {
    const name = firstName ?? 'there';
    const frontendUrl =
      process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:5713';
    const url = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(
      token,
    )}`;

    this.logger.log(`[Password reset] Link for ${email} (copy if mail not working): ${url}`);

    return this.send({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Reset your SendCoins admin password',
      text: `Hi ${name},

We received a request to reset your SendCoins admin password.

Please click the link below to set a new password:
${url}

If you did not request this, you can ignore this email.

Best,
SendCoins Team`,
    });
  }

  /**
   * Send a custom email (for Mail screen). Uses MAIL_FROM if from not provided.
   */
  async sendCustomEmail(options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    fromName?: string;
  }): Promise<boolean> {
    const fromRaw = options.from ?? process.env.MAIL_FROM ?? 'noreply@sendcoins.ca';
    // Extract raw address from RFC format (e.g. "Name" <addr> -> addr) to avoid double-nesting
    const fromAddr =
      typeof fromRaw === 'string' && fromRaw.includes('<')
        ? fromRaw.replace(/^[^<]*<([^>]+)>.*$/, '$1').trim()
        : fromRaw;
    const fromStr = options.fromName
      ? `"${options.fromName.replace(/"/g, '')}" <${fromAddr}>`
      : fromRaw;
    return this.send({
      from: fromStr,
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      bcc: options.bcc?.length ? options.bcc : undefined,
      subject: options.subject,
      text: options.text ?? undefined,
      html: options.html ?? undefined,
    });
  }

  /**
   * Verify SMTP connection is working
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Transporter not initialized' };
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`SMTP verification failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a test email (for diagnostics)
   */
  async sendTestEmail(
    to: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      this.logger.log(`Sending test email to: ${to}`);
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject: `SendCoins Test Email - ${new Date().toISOString()}`,
        text: `This is a test email sent at ${new Date().toISOString()}.\n\nIf you received this, email sending is working correctly.`,
        html: `<h2>SendCoins Test Email</h2><p>This is a test email sent at <strong>${new Date().toISOString()}</strong>.</p><p>If you received this, email sending is working correctly.</p>`,
      });
      this.logger.log(`Test email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      const err = error as Error & { code?: string; response?: string };
      this.logger.error(`Test email failed: ${err.message}`);
      return {
        success: false,
        error: `${err.message}${err.code ? ` (code: ${err.code})` : ''}`,
      };
    }
  }
}
