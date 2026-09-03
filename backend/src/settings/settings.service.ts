import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EncryptionService } from './encryption.service.js';
import type { Setting } from '../generated/prisma/index.js';
import type { SettingType, SettingView, UpsertSettingInput } from './settings.types.js';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private toView(setting: Setting): SettingView {
    const type = setting.type as SettingType;
    let value: string;
    if (type === 'secret') {
      if (!setting.encryptedValue || !setting.encryptionIv || !setting.encryptionTag) {
        value = '';
      } else {
        const plaintext = this.encryption.decrypt({
          ciphertext: Buffer.from(setting.encryptedValue),
          iv: Buffer.from(setting.encryptionIv),
          authTag: Buffer.from(setting.encryptionTag),
        });
        value = this.encryption.mask(plaintext);
      }
    } else {
      value = setting.value ?? '';
    }
    return {
      id: setting.id,
      category: setting.category,
      key: setting.key,
      type,
      value,
      version: setting.version,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    };
  }

  async list(tenantId: string, category?: string): Promise<SettingView[]> {
    const settings = await this.prisma.setting.findMany({
      where: { tenantId, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    return settings.map((s) => this.toView(s));
  }

  // Internal use only (e.g. building a Stripe client) — never expose this
  // through a controller, it returns the real secret value.
  async getPlaintext(tenantId: string, category: string, key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({
      where: { tenantId_category_key: { tenantId, category, key } },
    });
    if (!setting) return null;
    if (setting.type !== 'secret') return setting.value ?? null;
    if (!setting.encryptedValue || !setting.encryptionIv || !setting.encryptionTag) return null;
    return this.encryption.decrypt({
      ciphertext: Buffer.from(setting.encryptedValue),
      iv: Buffer.from(setting.encryptionIv),
      authTag: Buffer.from(setting.encryptionTag),
    });
  }

  async upsert(input: UpsertSettingInput): Promise<SettingView> {
    const { tenantId, category, key, type, value, updatedBy } = input;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.setting.findUnique({
        where: { tenantId_category_key: { tenantId, category, key } },
      });

      const isSecret = type === 'secret';
      const encrypted = isSecret ? this.encryption.encrypt(value) : null;

      if (existing) {
        // Preserve the previous version in history before overwriting.
        await tx.settingHistory.create({
          data: {
            settingId: existing.id,
            version: existing.version,
            type: existing.type,
            value: existing.value,
            encryptedValue: existing.encryptedValue,
            encryptionIv: existing.encryptionIv,
            encryptionTag: existing.encryptionTag,
            changedBy: existing.updatedBy,
          },
        });

        const updated = await tx.setting.update({
          where: { id: existing.id },
          data: {
            type,
            value: isSecret ? null : value,
            encryptedValue: encrypted?.ciphertext,
            encryptionIv: encrypted?.iv,
            encryptionTag: encrypted?.authTag,
            version: existing.version + 1,
            updatedBy: updatedBy ?? null,
          },
        });
        return this.toView(updated);
      }

      const created = await tx.setting.create({
        data: {
          tenantId,
          category,
          key,
          type,
          value: isSecret ? null : value,
          encryptedValue: encrypted?.ciphertext,
          encryptionIv: encrypted?.iv,
          encryptionTag: encrypted?.authTag,
          version: 1,
          updatedBy: updatedBy ?? null,
        },
      });
      return this.toView(created);
    });
  }

  // Restores a prior version from settings_history as the current value,
  // recording the version being replaced so rollback itself stays
  // reversible.
  async rollback(tenantId: string, settingId: string, toVersion: number, updatedBy?: string): Promise<SettingView> {
    return this.prisma.$transaction(async (tx) => {
      const setting = await tx.setting.findFirst({ where: { id: settingId, tenantId } });
      if (!setting) throw new NotFoundException('Setting not found');

      const target = await tx.settingHistory.findFirst({
        where: { settingId, version: toVersion },
      });
      if (!target) throw new NotFoundException(`Version ${toVersion} not found for this setting`);

      await tx.settingHistory.create({
        data: {
          settingId: setting.id,
          version: setting.version,
          type: setting.type,
          value: setting.value,
          encryptedValue: setting.encryptedValue,
          encryptionIv: setting.encryptionIv,
          encryptionTag: setting.encryptionTag,
          changedBy: setting.updatedBy,
        },
      });

      const restored = await tx.setting.update({
        where: { id: setting.id },
        data: {
          type: target.type,
          value: target.value,
          encryptedValue: target.encryptedValue,
          encryptionIv: target.encryptionIv,
          encryptionTag: target.encryptionTag,
          version: setting.version + 1,
          updatedBy: updatedBy ?? null,
        },
      });
      return this.toView(restored);
    });
  }
}
