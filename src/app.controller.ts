import { Controller, Get, UseGuards, Request, Response } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class AppController {
  constructor() { }

  @Get('health')
  getHealthStatus() {
    return { status: 'OK' };
  }

  @Get()
  async root(@Request() req, @Response() res) {
    // Check if user is authenticated via cookie
    const token = req.cookies?.['access_token'];

    if (!token) {
      // No authentication - redirect to login
      return res.redirect('/auth/login');
    }

    try {
      // Redirect to dashboard to handle proper user routing
      return res.redirect('/dashboard');
    } catch (error) {
      // Invalid token - redirect to login
      return res.redirect('/auth/login');
    }
  }

  @Get('dashboard')
  @UseGuards(AuthGuard('jwt'))
  async dashboard(@Request() req, @Response() res) {
    const user = req.user;

    if (user.isSuperadmin) {
      // Superadmins go to admin dashboard
      return res.redirect('/admin/dashboard');
    } else {
      // Regular users go to their assigned store edit page (keep as is)
      if (user.assignedStoreId) {
        return res.redirect(`/clients/edit/${user.assignedStoreId}`);
      } else {
        // User has no assigned store - show error or redirect to login
        return res.redirect('/auth/login?error=no_store_assigned');
      }
    }
  }
}
