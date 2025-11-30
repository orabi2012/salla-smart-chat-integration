import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
} from 'typeorm';

export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('salla_stores')
export class SallaStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  salla_store_id: string;

  @Column({ unique: true })
  salla_store_name: string;

  @Column()
  salla_owner_name: string;

  @Column()
  salla_owner_email: string;

  @Column()
  salla_access_token: string;

  @Column({ type: 'timestamp', nullable: true })
  salla_token_expiry: Date;

  @Column()
  salla_refresh_token: string;

  @Column({ nullable: true })
  salla_webhook_key: string; // Webhook secret key for signature verification

  @Column({ default: 'SAR', nullable: true })
  salla_currency: string; // Auto-fetched from Salla API

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 3.75 })
  currency_conversion_rate: number; // Manual rate: 1 USD = X Store_Currency

  @Column({ default: 'USD' })
  ubiqfy_currency: string; // Ubiqfy's base currency

  // Ubiqfy Authentication Fields
  @Column()
  ubiqfy_username: string;

  @Column()
  ubiqfy_password: string;

  @Column()
  ubiqfy_terminal_key: string;

  @Column({ default: true })
  ubiqfy_sandbox: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  ubiqfy_plafond: number;

  @Column({ type: 'timestamp', nullable: true })
  plafond_last_updated: Date;

  @Column({ default: 'Voucher' })
  ubiqfy_producttypecode: string;

  // SKU Configuration
  @Column({ default: 'UBQ', nullable: true })
  sku_prefix: string; // Customized prefix to add before SKU (e.g., 'UBQ-' + productCode)

  // System fields
  @Column({ default: false })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_sync_at: Date;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  sync_status: SyncStatus;

  @Column({ default: 0 })
  total_products_synced: number;

  @Column({ type: 'text', nullable: true })
  last_error_message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Temporary field to hold decrypted password (not persisted)
  private decryptedPassword?: string;

  @BeforeInsert()
  @BeforeUpdate()
  encryptPassword() {
    if (this.ubiqfy_password && !this.isPasswordEncrypted(this.ubiqfy_password)) {
      this.ubiqfy_password = this.encryptPasswordStatic(this.ubiqfy_password);
    }
  }

  @AfterLoad()
  decryptPassword() {
    if (this.ubiqfy_password && this.isPasswordEncrypted(this.ubiqfy_password)) {
      this.decryptedPassword = this.decryptPasswordStatic(this.ubiqfy_password);
    } else {
      this.decryptedPassword = this.ubiqfy_password;
    }
  }

  /**
   * Get the decrypted password for API usage
   */
  getDecryptedPassword(): string {
    return this.decryptedPassword || this.ubiqfy_password;
  }

  /**
   * Set a new password (will be encrypted on save)
   */
  setPassword(newPassword: string) {
    this.ubiqfy_password = newPassword;
    this.decryptedPassword = newPassword;
  }

  // Static methods for encryption/decryption that work in entity hooks
  private encryptPasswordStatic(password: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const keyLength = 32;
    const ivLength = 16;

    if (!password || password.trim() === '') {
      throw new Error('Password cannot be empty');
    }

    try {
      const key = this.getEncryptionKeyStatic();
      const iv = crypto.randomBytes(ivLength);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      cipher.setAAD(Buffer.from('ubiqfy-password', 'utf8'));

      let encrypted = cipher.update(password, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
    } catch (error) {
      throw new Error(`Failed to encrypt password: ${error.message}`);
    }
  }

  private decryptPasswordStatic(encryptedPassword: string): string {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';

    if (!encryptedPassword || encryptedPassword.trim() === '') {
      throw new Error('Encrypted password cannot be empty');
    }

    try {
      const parts = encryptedPassword.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted password format');
      }

      const [ivBase64, encryptedData, authTagBase64] = parts;
      const key = this.getEncryptionKeyStatic();
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAAD(Buffer.from('ubiqfy-password', 'utf8'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt password: ${error.message}`);
    }
  }

  private isPasswordEncrypted(password: string): boolean {
    if (!password) return false;

    const parts = password.split(':');
    if (parts.length !== 3) return false;

    try {
      Buffer.from(parts[0], 'base64');
      Buffer.from(parts[2], 'base64');
      return true;
    } catch {
      return false;
    }
  }

  private getEncryptionKeyStatic(): Buffer {
    const crypto = require('crypto');
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    if (key.length < 32) {
      return crypto.pbkdf2Sync(key, 'ubiqfy-salt', 10000, 32, 'sha256');
    }

    return Buffer.from(key.slice(0, 32), 'utf8');
  }
}
