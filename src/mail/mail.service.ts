import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.ZEPTO_HOST ?? 'smtp.zeptomail.com',
    port: Number(process.env.ZEPTO_PORT ?? 587),
    auth: {
      user: process.env.ZEPTO_USER,
      pass: process.env.ZEPTO_API_KEY,
    },
  });

  async send(options: nodemailer.SendMailOptions): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail(options);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Mail not sent', error);
      return false;
    }
  }

  async sendAdminPasswordSetupLink(
    email: string,
    token: string,
    firstName?: string,
  ): Promise<boolean> {
    const name = firstName ?? 'there';
    const frontendUrl = process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:4000';
    const url = `${frontendUrl.replace(/\/$/, '')}/set-password?token=${encodeURIComponent(
      token,
    )}`;

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
    const frontendUrl = process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:4000';
    const url = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(
      token,
    )}`;

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
}


