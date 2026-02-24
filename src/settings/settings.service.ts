import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SystemSetting {
  id: number;
  settingKey: string;
  settingValue: string;
  settingType: 'string' | 'number' | 'boolean' | 'json';
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all system settings
   */
  async getAllSettings(): Promise<SystemSetting[]> {
    const rows = await this.prisma.client.systemSetting.findMany({
      orderBy: { settingKey: 'asc' },
    });
    return rows.map((s) => this.toSystemSetting(s));
  }

  /**
   * Get a single setting by key
   */
  async getSetting(key: string): Promise<SystemSetting | null> {
    const row = await this.prisma.client.systemSetting.findUnique({
      where: { settingKey: key },
    });
    return row ? this.toSystemSetting(row) : null;
  }

  /**
   * Update a system setting
   */
  async updateSetting(
    key: string,
    value: string,
    adminId: number,
  ): Promise<SystemSetting> {
    const existing = await this.getSetting(key);
    if (!existing) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    const row = await this.prisma.client.systemSetting.update({
      where: { settingKey: key },
      data: {
        settingValue: value,
        updatedBy: String(adminId),
      },
    });

    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'SETTING_UPDATED',
        detail: {
          resourceType: 'SYSTEM_SETTING',
          resourceId: key,
          key,
          oldValue: existing.settingValue,
          newValue: value,
        },
      },
    });

    return this.toSystemSetting(row);
  }

  /**
   * Create a new system setting
   */
  async createSetting(
    key: string,
    value: string,
    type: SystemSetting['settingType'],
    description: string,
    adminId: number,
  ): Promise<SystemSetting> {
    const existing = await this.getSetting(key);
    if (existing) {
      throw new Error(`Setting '${key}' already exists`);
    }

    const row = await this.prisma.client.systemSetting.create({
      data: {
        settingKey: key,
        settingValue: value,
        settingType: type,
        description,
        updatedBy: String(adminId),
      },
    });

    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'SETTING_CREATED',
        detail: {
          resourceType: 'SYSTEM_SETTING',
          resourceId: key,
          key,
          value,
          type,
          description,
        },
      },
    });

    return this.toSystemSetting(row);
  }

  /**
   * Delete a system setting
   */
  async deleteSetting(key: string, adminId: number): Promise<void> {
    const existing = await this.getSetting(key);
    if (!existing) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    await this.prisma.client.systemSetting.delete({
      where: { settingKey: key },
    });

    await this.prisma.client.adminAuditLog.create({
      data: {
        adminId,
        action: 'SETTING_DELETED',
        detail: {
          resourceType: 'SYSTEM_SETTING',
          resourceId: key,
          key,
          value: existing.settingValue,
        },
      },
    });
  }

  /**
   * Get parsed value of a setting
   */
  async getSettingValue<T = string>(key: string, defaultValue?: T): Promise<T> {
    const setting = await this.getSetting(key);
    if (!setting) {
      if (defaultValue !== undefined) return defaultValue;
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    switch (setting.settingType) {
      case 'number':
        return parseFloat(setting.settingValue) as T;
      case 'boolean':
        return (setting.settingValue === 'true') as T;
      case 'json':
        return JSON.parse(setting.settingValue) as T;
      default:
        return setting.settingValue as T;
    }
  }

  private toSystemSetting(row: {
    id: number;
    settingKey: string;
    settingValue: string;
    settingType: string;
    description: string | null;
    updatedBy: string | null;
    updatedAt: Date | null;
    createdAt: Date;
  }): SystemSetting {
    return {
      id: row.id,
      settingKey: row.settingKey,
      settingValue: row.settingValue,
      settingType: row.settingType as SystemSetting['settingType'],
      description: row.description,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }
}
