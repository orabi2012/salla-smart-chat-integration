import {
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Render,
  Response,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('login')
  @Render('login')
  getLogin() {
    return { title: 'Login' };
  }

  @Post('login')
  async login(
    @Body() body: { username: string; password: string; rememberMe?: boolean },
    @Response() res,
  ) {
    try {
      // Validate input
      if (!body.username || !body.password) {
        return res.status(400).json({
          message: 'Username and password are required',
          field: 'validation',
        });
      }

      if (
        body.username.trim().length === 0 ||
        body.password.trim().length === 0
      ) {
        return res.status(400).json({
          message: 'Username and password cannot be empty',
          field: 'validation',
        });
      }

      const user = await this.authService.validateUser(
        body.username.trim(),
        body.password,
      );

      if (!user) {
        return res.status(401).json({
          message:
            'Invalid username or password. Please check your credentials and try again.',
          field: 'credentials',
        });
      }

      const result = await this.authService.login(
        user,
        body.rememberMe || false,
      );

      // Set cookie for web interface
      const maxAge = body.rememberMe
        ? 30 * 24 * 60 * 60 * 1000 // 30 days if remember me is checked
        : 24 * 60 * 60 * 1000; // 24 hours for regular login

      res.cookie('access_token', result.access_token, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'strict',
        maxAge,
      });

      return res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        message: 'An error occurred during login. Please try again.',
        field: 'server',
      });
    }
  }

  @Post('logout')
  async logout(@Response() res) {
    try {
      // Clear the access_token cookie
      res.clearCookie('access_token', {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'strict',
      });

      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      return res.status(500).json({ message: 'Error during logout' });
    }
  }

  @Get('logout')
  async logoutGet(@Response() res) {
    try {
      // Clear the access_token cookie
      res.clearCookie('access_token', {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'strict',
      });

      // Redirect to login page after logout
      return res.redirect('/auth/login?logout=true');
    } catch (error) {
      return res.redirect('/auth/login');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
