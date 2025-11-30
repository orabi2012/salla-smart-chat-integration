import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

  async onModuleInit() {
    const superadminExists = await this.userRepo.findOne({
      where: { username: 'superadmin' },
    });
    if (!superadminExists) {
      const password = process.env.SAP;

      if (!password) {
        throw new Error('SUPERADMIN_PASSWORD environment variable is not set');
      }

      const superadmin = this.userRepo.create({
        username: 'superadmin',
        password: password, // Will be automatically hashed by the entity hook
        isActive: true,
        isSuperadmin: true,
      });
      await this.userRepo.save(superadmin);
      console.log('Superadmin user created with hashed password.');
    } else {
      console.log('Superadmin user already exists.');
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.userRepo.findOne({
      where: { username },
      relations: ['assignedStore']
    });
  }

  async findAll(): Promise<User[]> {
    return await this.userRepo.find({
      relations: ['assignedStore'],
      order: { username: 'ASC' }
    });
  }

  async createUser(userData: {
    username: string;
    password: string;
    assignedStoreId?: string;
  }): Promise<User> {
    const user = this.userRepo.create({
      username: userData.username,
      password: userData.password,
      assignedStoreId: userData.assignedStoreId,
      isActive: true,
      isSuperadmin: false,
    });
    return await this.userRepo.save(user);
  }

  async updateUser(id: string, userData: {
    username?: string;
    password?: string;
    assignedStoreId?: string;
    isActive?: boolean;
  }): Promise<User | null> {
    // Find the existing user
    const existingUser = await this.userRepo.findOne({
      where: { id },
      relations: ['assignedStore']
    });

    if (!existingUser) {
      return null;
    }

    // Update the user fields
    if (userData.username !== undefined) {
      existingUser.username = userData.username;
    }
    if (userData.assignedStoreId !== undefined) {
      existingUser.assignedStoreId = userData.assignedStoreId;
    }
    if (userData.isActive !== undefined) {
      existingUser.isActive = userData.isActive;
    }

    // Handle password update - only if a new password is provided
    if (userData.password && userData.password.trim() !== '') {
      existingUser.password = userData.password; // This will be hashed by the @BeforeUpdate hook
    }

    // Save the user (this will trigger the @BeforeUpdate hook to hash the password)
    return await this.userRepo.save(existingUser);
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepo.delete(id);
  }

  async toggleUserStatus(id: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['assignedStore']
    });

    if (!user) {
      return null;
    }

    // Toggle the isActive status
    user.isActive = !user.isActive;
    return await this.userRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepo.findOne({
      where: { id },
      relations: ['assignedStore']
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the user
      const user = await this.userRepo.findOne({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, message: 'User not found.' };
      }

      // Verify current password
      const isCurrentPasswordValid = await this.validatePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return { success: false, message: 'Current password is incorrect.' };
      }

      // Update password
      user.password = newPassword; // This will be hashed by the @BeforeUpdate hook
      await this.userRepo.save(user);

      return { success: true, message: 'Password changed successfully.' };
    } catch (error) {
      console.error('Error changing password:', error);
      return { success: false, message: 'An error occurred while changing password.' };
    }
  }
}
