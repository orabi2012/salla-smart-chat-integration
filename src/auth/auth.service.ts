import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    try {
      // Check if username exists
      const user = await this.usersService.findByUsername(username);
      if (!user) {
        return null; // User not found
      }

      // Check if user is active
      if (!user.isActive) {
        return null; // User is inactive
      }

      // Validate password
      const isPasswordValid = await this.usersService.validatePassword(
        password,
        user.password,
      );
      if (!isPasswordValid) {
        return null; // Invalid password
      }

      // Return user without password
      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  }

  async login(user: any, rememberMe: boolean = false) {
    const payload = {
      username: user.username,
      sub: user.id,
      isSuperadmin: user.isSuperadmin,
      assignedStoreId: user.assignedStoreId,
    };

    const expiresIn = rememberMe ? '30d' : '1d';

    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: {
        id: user.id,
        username: user.username,
        isActive: user.isActive,
        isSuperadmin: user.isSuperadmin,
        assignedStoreId: user.assignedStoreId,
      },
    };
  }
}
