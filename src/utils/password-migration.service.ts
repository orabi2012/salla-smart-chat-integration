import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SallaStore } from '../salla-stores/salla-stores.entity';
import { PasswordService } from './password.service';

@Injectable()
export class PasswordMigrationService {
  private readonly logger = new Logger(PasswordMigrationService.name);

  constructor(
    @InjectRepository(SallaStore)
    private sallaStoreRepo: Repository<SallaStore>,
    private passwordService: PasswordService,
  ) {}

  /**
   * Migrate all existing plain text passwords to encrypted format
   * This should be run once during deployment
   */
  async migrateExistingPasswords(): Promise<{
    total: number;
    encrypted: number;
    skipped: number;
    errors: number;
  }> {
    this.logger.log('Starting password migration...');

    const stores = await this.sallaStoreRepo.find();
    let encrypted = 0;
    let skipped = 0;
    let errors = 0;

    for (const store of stores) {
      try {
        // Skip if password is already encrypted
        if (this.passwordService.isPasswordEncrypted(store.ubiqfy_password)) {
          skipped++;
          this.logger.debug(
            `Store ${store.salla_store_name}: Password already encrypted, skipping`,
          );
          continue;
        }

        // Skip if password is empty
        if (!store.ubiqfy_password || store.ubiqfy_password.trim() === '') {
          skipped++;
          this.logger.debug(
            `Store ${store.salla_store_name}: Empty password, skipping`,
          );
          continue;
        }

        // Encrypt the password
        const originalPassword = store.ubiqfy_password;
        store.setPassword(originalPassword);

        // Save without triggering entity hooks (to avoid double encryption)
        await this.sallaStoreRepo.update(store.id, {
          ubiqfy_password:
            this.passwordService.encryptPassword(originalPassword),
        });

        encrypted++;
        this.logger.log(
          `Store ${store.salla_store_name}: Password encrypted successfully`,
        );
      } catch (error) {
        errors++;
        this.logger.error(
          `Store ${store.salla_store_name}: Failed to encrypt password - ${error.message}`,
        );
      }
    }

    const result = {
      total: stores.length,
      encrypted,
      skipped,
      errors,
    };

    this.logger.log(`Password migration completed: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Verify that all passwords can be decrypted correctly
   */
  async verifyPasswordEncryption(): Promise<{
    total: number;
    verified: number;
    failed: number;
    details: Array<{
      storeName: string;
      status: 'verified' | 'failed';
      error?: string;
    }>;
  }> {
    this.logger.log('Starting password verification...');

    const stores = await this.sallaStoreRepo.find();
    let verified = 0;
    let failed = 0;
    const details: Array<{
      storeName: string;
      status: 'verified' | 'failed';
      error?: string;
    }> = [];

    for (const store of stores) {
      try {
        // Skip if password is empty
        if (!store.ubiqfy_password || store.ubiqfy_password.trim() === '') {
          details.push({
            storeName: store.salla_store_name,
            status: 'verified',
          });
          verified++;
          continue;
        }

        // Try to decrypt the password
        const decryptedPassword = store.getDecryptedPassword();

        if (decryptedPassword && decryptedPassword.length > 0) {
          verified++;
          details.push({
            storeName: store.salla_store_name,
            status: 'verified',
          });
          this.logger.debug(
            `Store ${store.salla_store_name}: Password verification successful`,
          );
        } else {
          failed++;
          details.push({
            storeName: store.salla_store_name,
            status: 'failed',
            error: 'Decrypted password is empty',
          });
        }
      } catch (error) {
        failed++;
        details.push({
          storeName: store.salla_store_name,
          status: 'failed',
          error: error.message,
        });
        this.logger.error(
          `Store ${store.salla_store_name}: Password verification failed - ${error.message}`,
        );
      }
    }

    const result = {
      total: stores.length,
      verified,
      failed,
      details,
    };

    this.logger.log(
      `Password verification completed: verified=${verified}, failed=${failed}`,
    );
    return result;
  }
}
