import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Render,
  UseGuards,
  Request,
  Redirect,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { SallaStoresService } from '../salla-stores/salla-stores.service';
import { UsersService } from '../users/users.service';
@Controller('admin')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly sallaStoresService: SallaStoresService,
    private readonly usersService: UsersService,
  ) {}

  @Get('dashboard')
  @Render('admin/dashboard')
  async dashboard(@Request() req) {
    const stores = await this.sallaStoresService.findAll();
    const users = await this.usersService.findAll();

    return {
      title: 'Admin Dashboard',
      user: req.user,
      stores: stores,
      users: users,
      storeCount: stores.length,
      userCount: users.length,
      activeStores: stores.filter((s) => s.is_active).length,
      activeUsers: users.filter((u) => u.isActive).length,
    };
  }

  // Store Management
  @Get('stores')
  @Render('admin/stores')
  async stores(@Request() req) {
    const stores = await this.sallaStoresService.findAll();
    return {
      title: 'Store Management',
      user: req.user,
      stores: stores,
    };
  }

  @Get('stores/add')
  async addStore(@Res() res) {
    // Redirect admin to the normal add store page
    return res.redirect('/clients/add');
  }

  @Get('stores/:id/edit')
  async editStore(@Param('id') id: string, @Res() res) {
    // Redirect admin to the normal user store settings page
    return res.redirect(`/clients/edit/${id}`);
  }

  @Post('stores/:id/toggle-status')
  async toggleStoreStatus(@Param('id') id: string, @Res() res) {
    try {
      await this.sallaStoresService.toggleActive(id);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // User Management
  @Get('users')
  @Render('admin/users')
  async users(@Request() req) {
    const users = await this.usersService.findAll();
    const stores = await this.sallaStoresService.findAll();
    return {
      title: 'User Management',
      user: req.user,
      users: users,
      stores: stores,
    };
  }

  @Get('users/add')
  async addUser(@Res() res) {
    // Redirect admin to the normal add user page
    return res.redirect('/users/add');
  }

  @Get('users/:id/edit')
  async editUser(@Param('id') id: string, @Res() res) {
    // Redirect admin to the normal edit user page
    return res.redirect(`/users/edit/${id}`);
  }

  @Post('users/:id/toggle-status')
  async toggleUserStatus(@Param('id') id: string, @Res() res) {
    try {
      await this.usersService.toggleUserStatus(id);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
