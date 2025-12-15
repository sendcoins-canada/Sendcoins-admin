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
      users,
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

    return user;
  }
}
