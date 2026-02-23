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
    const result = await this.prisma.client.$queryRaw<
      Array<{
        id: number;
        setting_key: string;
        setting_value: string;
        setting_type: string;
        description: string | null;
        updated_by: string | null;
        updated_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT * FROM system_settings ORDER BY setting_key ASC
    `;

    return result.map((s) => ({
      id: s.id,
      settingKey: s.setting_key,
      settingValue: s.setting_value,
      settingType: s.setting_type as SystemSetting['settingType'],
      description: s.description,
      updatedBy: s.updated_by,
      updatedAt: s.updated_at,
      createdAt: s.created_at,
    }));
  }

  /**
   * Get a single setting by key
   */
  async getSetting(key: string): Promise<SystemSetting | null> {
    const result = await this.prisma.client.$queryRaw<
      Array<{
        id: number;
        setting_key: string;
        setting_value: string;
        setting_type: string;
        description: string | null;
        updated_by: string | null;
        updated_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT * FROM system_settings WHERE setting_key = ${key} LIMIT 1
    `;

    if (result.length === 0) {
      return null;
    }

    const s = result[0];
    return {
      id: s.id,
      settingKey: s.setting_key,
      settingValue: s.setting_value,
      settingType: s.setting_type as SystemSetting['settingType'],
      description: s.description,
      updatedBy: s.updated_by,
      updatedAt: s.updated_at,
      createdAt: s.created_at,
    };
  }

  /**
   * Update a system setting
   */
  async updateSetting(
    key: string,
    value: string,
    adminId: number,
  ): Promise<SystemSetting> {
    // Check if setting exists
    const existing = await this.getSetting(key);
    if (!existing) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    const result = await this.prisma.client.$queryRaw<
      Array<{
        id: number;
        setting_key: string;
        setting_value: string;
        setting_type: string;
        description: string | null;
        updated_by: string | null;
        updated_at: Date | null;
        created_at: Date;
      }>
    >`
      UPDATE system_settings
      SET setting_value = ${value},
          updated_by = ${String(adminId)},
          updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ${key}
      RETURNING *
    `;

    const s = result[0];

    // Log the action
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

    return {
      id: s.id,
      settingKey: s.setting_key,
      settingValue: s.setting_value,
      settingType: s.setting_type as SystemSetting['settingType'],
      description: s.description,
      updatedBy: s.updated_by,
      updatedAt: s.updated_at,
      createdAt: s.created_at,
    };
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
    // Check if setting already exists
    const existing = await this.getSetting(key);
    if (existing) {
      throw new Error(`Setting '${key}' already exists`);
    }

    const result = await this.prisma.client.$queryRaw<
      Array<{
        id: number;
        setting_key: string;
        setting_value: string;
        setting_type: string;
        description: string | null;
        updated_by: string | null;
        updated_at: Date | null;
        created_at: Date;
      }>
    >`
      INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_by)
      VALUES (${key}, ${value}, ${type}, ${description}, ${String(adminId)})
      RETURNING *
    `;

    const s = result[0];

    // Log the action
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

    return {
      id: s.id,
      settingKey: s.setting_key,
      settingValue: s.setting_value,
      settingType: s.setting_type as SystemSetting['settingType'],
      description: s.description,
      updatedBy: s.updated_by,
      updatedAt: s.updated_at,
      createdAt: s.created_at,
    };
  }

  /**
   * Delete a system setting
   */
  async deleteSetting(key: string, adminId: number): Promise<void> {
    const existing = await this.getSetting(key);
    if (!existing) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }

    await this.prisma.client.$queryRaw`
      DELETE FROM system_settings WHERE setting_key = ${key}
    `;

    // Log the action
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
}
