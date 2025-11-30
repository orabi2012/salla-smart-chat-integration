import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits

  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // If the key is shorter than 32 bytes, derive it using PBKDF2
    if (key.length < 32) {
      return crypto.pbkdf2Sync(
        key,
        'ubiqfy-salt',
        10000,
        this.keyLength,
        'sha256',
      );
    }

    // If the key is longer, truncate it to 32 bytes
    return Buffer.from(key.slice(0, 32), 'utf8');
  }

  /**
   * Encrypts a password using AES-256-GCM
   * Returns the encrypted data in format: iv:encryptedData:authTag (base64 encoded)
   */
  encryptPassword(password: string): string {
    if (!password || password.trim() === '') {
      throw new Error('Password cannot be empty');
    }

    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from('ubiqfy-password', 'utf8'));

      let encrypted = cipher.update(password, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      // Combine iv, encrypted data, and auth tag
      const result = `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
      return result;
    } catch (error) {
      throw new Error(`Failed to encrypt password: ${error.message}`);
    }
  }

  /**
   * Decrypts a password that was encrypted with encryptPassword
   * Expects format: iv:encryptedData:authTag (base64 encoded)
   */
  decryptPassword(encryptedPassword: string): string {
    if (!encryptedPassword || encryptedPassword.trim() === '') {
      throw new Error('Encrypted password cannot be empty');
    }

    try {
      const parts = encryptedPassword.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted password format');
      }

      const [ivBase64, encryptedData, authTagBase64] = parts;
      const key = this.getEncryptionKey();
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAAD(Buffer.from('ubiqfy-password', 'utf8'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt password: ${error.message}`);
    }
  }

  /**
   * Checks if a password is already encrypted (contains our format)
   */
  isPasswordEncrypted(password: string): boolean {
    if (!password) return false;

    const parts = password.split(':');
    if (parts.length !== 3) return false;

    try {
      // Try to decode base64 parts
      Buffer.from(parts[0], 'base64');
      Buffer.from(parts[2], 'base64');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely encrypts a password if it's not already encrypted
   */
  safeEncryptPassword(password: string): string {
    if (!password) return password;

    if (this.isPasswordEncrypted(password)) {
      return password; // Already encrypted
    }

    return this.encryptPassword(password);
  }

  /**
   * Safely decrypts a password if it's encrypted, otherwise returns as-is
   * This is useful during migration period
   */
  safeDecryptPassword(password: string): string {
    if (!password) return password;

    if (this.isPasswordEncrypted(password)) {
      return this.decryptPassword(password);
    }

    return password; // Not encrypted, return as-is
  }
}
