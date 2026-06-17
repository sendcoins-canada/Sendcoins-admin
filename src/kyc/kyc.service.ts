import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { GetKycQueryDto, KycStatus } from './dto/get-kyc-query.dto';

interface UserRow {
  azer_id: number;
  first_name: string | null;
  last_name: string | null;
  user_email: string | null;
  verify_user: boolean | null;
  phone: string | null;
  country: string | null;
  location: string | null;
  profile_pix: string | null;
  company_name: string | null;
  company_verify: string | null;
  timestamp: Date;
}

interface VerificationRow {
  id: number;
  user_api_key: string;
  verification_id: string;
  created_at: Date | null;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findAll(query: GetKycQueryDto) {
    const {
      page = 1,
      limit = 20,
      status = KycStatus.PENDING,
      search,
      country,
    } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Filter by KYC status
    if (status === KycStatus.PENDING) {
      whereClause += ` AND (verify_user IS NULL OR verify_user = false)`;
    } else if (status === KycStatus.VERIFIED) {
      whereClause += ` AND verify_user = true`;
    } else if (status === KycStatus.REJECTED) {
      // For rejected, we'd need a separate field. For now, treat as not verified
      whereClause += ` AND verify_user = false`;
    }
    // KycStatus.ALL shows all users

    if (search) {
      whereClause += ` AND (user_email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (country) {
      whereClause += ` AND country ILIKE $${paramIndex}`;
      params.push(`%${country}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM send_coin_user ${whereClause}`;
    const countResult = await this.prisma.client.$queryRawUnsafe<
      [{ total: bigint }]
    >(countQuery, ...params);
    const total = Number(countResult[0]?.total || 0);

    const dataQuery = `
      SELECT azer_id, first_name, last_name, user_email, verify_user, phone, country, location, profile_pix, company_name, company_verify, timestamp
      FROM send_coin_user
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const users = await this.prisma.client.$queryRawUnsafe<UserRow[]>(
      dataQuery,
      ...params,
      limit,
      offset,
    );

    return {
      users: users.map((u) => ({
        userId: u.azer_id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.user_email,
        kycStatus: u.verify_user ? 'verified' : 'pending',
        phone: u.phone,
        country: u.country,
        location: u.location,
        profilePicture: u.profile_pix,
        companyName: u.company_name,
        companyVerified: u.company_verify === '1',
        createdAt: u.timestamp,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getKycDetails(userId: number) {
    // Get user details
    const userQuery = `
      SELECT azer_id, first_name, last_name, user_email, verify_user, phone, country, location,
             profile_pix, company_name, company_verify, address, timestamp, api_key
      FROM send_coin_user
      WHERE azer_id = $1
    `;

    const users = await this.prisma.client.$queryRawUnsafe<
      Array<UserRow & { address: string | null; api_key: string | null }>
    >(userQuery, userId);

    if (!users.length) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const user = users[0];

    // Get verification info if available
    let verificationInfo = null;
    if (user.api_key) {
      const verifyQuery = `
        SELECT id, user_api_key, verification_id, created_at
        FROM coin_azer_verify_user
        WHERE user_api_key = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const verifications = await this.prisma.client.$queryRawUnsafe<
        VerificationRow[]
      >(verifyQuery, user.api_key);
      if (verifications.length) {
        verificationInfo = {
          verificationId: verifications[0].verification_id,
          submittedAt: verifications[0].created_at,
        };
      }
    }

    return {
      userId: user.azer_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.user_email,
      kycStatus: user.verify_user ? 'verified' : 'pending',
      phone: user.phone,
      country: user.country,
      location: user.location,
      address: user.address,
      profilePicture: user.profile_pix,
      companyName: user.company_name,
      companyVerified: user.company_verify === '1',
      createdAt: user.timestamp,
      verification: verificationInfo,
    };
  }

  async approveKyc(userId: number, adminId: number, notes?: string) {
    // Check if user exists
    const checkQuery = `SELECT azer_id, user_email, first_name, verify_user FROM send_coin_user WHERE azer_id = $1`;
    const users = await this.prisma.client.$queryRawUnsafe<
      Array<{
        azer_id: number;
        user_email: string | null;
        first_name: string | null;
        verify_user: boolean | null;
      }>
    >(checkQuery, userId);

    if (!users.length) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Update verify_user to true
    const updateQuery = `UPDATE send_coin_user SET verify_user = true WHERE azer_id = $1`;
    await this.prisma.client.$executeRawUnsafe(updateQuery, userId);

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'KYC_APPROVED',
        adminId,
        detail: {
          userId,
          email: users[0].user_email,
          notes,
        },
      },
    });

    // Send approval email
    if (users[0].user_email) {
      try {
        await this.mailService.sendCustomEmail({
          to: [users[0].user_email],
          subject: 'Your Sendcoins identity verification has been approved',
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #166534;">Identity Verified ✓</h2>
              <p>Hi ${users[0].first_name || 'there'},</p>
              <p>Great news! Your identity verification has been <strong>approved</strong>. You now have full access to all Sendcoins features.</p>
              <p>You can now:</p>
              <ul>
                <li>Send and receive crypto</li>
                <li>Access higher transaction limits</li>
              </ul>
              <p>Thank you for verifying your identity.</p>
              <p>— The Sendcoins Team</p>
            </div>
          `,
        });
      } catch (err: any) {
        this.logger.error(`Failed to send KYC approval email to ${users[0].user_email}: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `KYC approved for user ${userId}`,
      userId,
      kycStatus: 'verified',
    };
  }

  async rejectKyc(
    userId: number,
    adminId: number,
    reason: string,
    notes?: string,
  ) {
    // Check if user exists
    const checkQuery = `SELECT azer_id, user_email, first_name, verify_user FROM send_coin_user WHERE azer_id = $1`;
    const users = await this.prisma.client.$queryRawUnsafe<
      Array<{
        azer_id: number;
        user_email: string | null;
        first_name: string | null;
        verify_user: boolean | null;
      }>
    >(checkQuery, userId);

    if (!users.length) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Keep verify_user as false (or set explicitly)
    const updateQuery = `UPDATE send_coin_user SET verify_user = false WHERE azer_id = $1`;
    await this.prisma.client.$executeRawUnsafe(updateQuery, userId);

    // Log the action
    await this.prisma.client.adminAuditLog.create({
      data: {
        action: 'KYC_REJECTED',
        adminId,
        detail: {
          userId,
          email: users[0].user_email,
          reason,
          notes,
        },
      },
    });

    // Send rejection email
    if (users[0].user_email) {
      try {
        await this.mailService.sendCustomEmail({
          to: [users[0].user_email],
          subject: 'Your Sendcoins identity verification needs attention',
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #991b1b;">Verification Not Approved</h2>
              <p>Hi ${users[0].first_name || 'there'},</p>
              <p>Unfortunately, we were unable to approve your identity verification.</p>
              <p><strong>Reason:</strong> ${reason}</p>
              <p>Please re-submit your verification with a valid government-issued ID and a clear selfie. Make sure:</p>
              <ul>
                <li>Your document is not expired</li>
                <li>All details are clearly visible</li>
                <li>Your selfie matches the photo on your ID</li>
              </ul>
              <p>If you believe this was a mistake, please contact our support team.</p>
              <p>— The Sendcoins Team</p>
            </div>
          `,
        });
      } catch (err: any) {
        this.logger.error(`Failed to send KYC rejection email to ${users[0].user_email}: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `KYC rejected for user ${userId}`,
      userId,
      kycStatus: 'rejected',
      reason,
    };
  }

  async getKycStats() {
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN verify_user = true THEN 1 END) as verified,
        COUNT(CASE WHEN verify_user IS NULL OR verify_user = false THEN 1 END) as pending
      FROM send_coin_user
    `;

    const result =
      await this.prisma.client.$queryRawUnsafe<
        Array<{ total: bigint; verified: bigint; pending: bigint }>
      >(statsQuery);

    return {
      total: Number(result[0]?.total || 0),
      verified: Number(result[0]?.verified || 0),
      pending: Number(result[0]?.pending || 0),
      verificationRate:
        result[0]?.total > 0
          ? (
              (Number(result[0]?.verified || 0) / Number(result[0]?.total)) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };
  }
}
