import { Injectable, BadRequestException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MfaService {
  /**
   * Generate a new TOTP secret for an admin
   */
  generateSecret(
    email: string,
    issuer: string = 'SendCoins Admin',
  ): {
    secret: string;
    otpauthUrl: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${email})`,
      issuer,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Generate QR code data URL for the TOTP secret
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch {
      throw new BadRequestException('Failed to generate QR code');
    }
  }

  /**
   * Verify a TOTP code against a secret
   */
  verifyToken(secret: string, token: string, window: number = 2): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window, // Allow 2 time steps before/after current time
    });
  }

  /**
   * Generate backup codes (one-time use codes)
   */
  async generateBackupCodes(count: number = 10): Promise<{
    codes: string[];
    hashedCodes: string[];
  }> {
    const codes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-digit code
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      codes.push(code);
      // Hash the code for storage
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    return { codes, hashedCodes };
  }

  /**
   * Verify a backup code against hashed codes array
   */
  async verifyBackupCode(
    code: string,
    hashedCodes: string[],
  ): Promise<boolean> {
    for (const hashed of hashedCodes) {
      const isValid = await bcrypt.compare(code, hashed);
      if (isValid) {
        return true;
      }
    }
    return false;
  }

  /**
   * Remove a used backup code from the array
   */
  removeBackupCode(hashedCodes: string[], usedHashedCode: string): string[] {
    return hashedCodes.filter((h) => h !== usedHashedCode);
  }
}
