import {
  Controller,
  Get,
  Render,
  UseGuards,
  Request,
  Post,
  Redirect,
  Body,
  Param,
  Put,
  Delete,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { StoreAccessGuard } from '../auth/store-access.guard';
import { SallaStoresService } from '../salla-stores/salla-stores.service';
import { SallaStore } from '../salla-stores/salla-stores.entity';

@Controller('clients')
@UseGuards(AuthGuard('jwt'))
export class ClientsController {
  constructor(private readonly sallaStoresService: SallaStoresService) {}

  @Get()
  @UseGuards(SuperAdminGuard)
  @Render('clients/index')
  async getClients(@Request() req) {
    const stores = await this.sallaStoresService.findAll();
    return {
      title: 'Salla Stores Management',
      user: req.user,
      stores: stores,
    };
  }

  @Get('add')
  @UseGuards(SuperAdminGuard)
  @Render('clients/add')
  async getAddClient(@Request() req) {
    const errorParam = req.query.error;
    const successParam = req.query.success;

    let errorMessage: string | null = null;
    let successMessage: string | null = null;

    if (errorParam === 'missing_salla_credentials') {
      errorMessage =
        'Salla Client ID and Client Secret are required. Please get them from your Salla Partner Portal.';
    } else if (errorParam === 'failed_to_add') {
      errorMessage =
        'Failed to add store. Please check your information and try again.';
    } else if (errorParam) {
      errorMessage = decodeURIComponent(errorParam as string);
    }

    if (successParam === 'store_added') {
      successMessage = 'Store added successfully!';
    }

    return {
      title: 'Add New Store',
      user: req.user,
      error: errorMessage,
      success: successMessage,
    };
  }

  @Get('edit/:id')
  @UseGuards(StoreAccessGuard)
  @Render('clients/edit')
  async getEditClient(@Request() req, @Param('id') id: string) {
    const store = await this.sallaStoresService.findById(id);
    if (!store) {
      return { redirect: '/clients?error=store_not_found' };
    }
    return {
      title: 'Edit Store',
      user: req.user,
      store: store,
    };
  }

  @Post('add')
  @UseGuards(SuperAdminGuard)
  async addClient(@Body() body: any, @Res() res) {
    try {
      // Handle toggle switches properly
      const storeData: Partial<SallaStore> = {
        ...body,
        // Parse currency conversion rate
        currency_conversion_rate:
          parseFloat(body.currency_conversion_rate) || 3.75,
        ubiqfy_currency: body.ubiqfy_currency || 'USD',
        sku_prefix: body.sku_prefix || 'UBQ',
        // Toggle switches: 'true' when on, undefined when off
        is_active: true, // New stores are active by default
        ubiqfy_sandbox: body.ubiqfy_sandbox === 'true',
      };

      console.log('Adding store with data:', {
        currency_conversion_rate: storeData.currency_conversion_rate,
        ubiqfy_currency: storeData.ubiqfy_currency,
      });

      await this.sallaStoresService.create(storeData);
      return res.redirect('/clients?success=store_added');
    } catch (error) {
      console.error('Error adding store:', error);
      return res.redirect('/clients/add?error=failed_to_add');
    }
  }

  @Post('edit/:id')
  @UseGuards(StoreAccessGuard)
  async editClient(
    @Param('id') id: string,
    @Body() body: any,
    @Res() res,
    @Request() req,
  ) {
    try {
      // Define protected fields that only superadmins can modify
      const protectedFields = [
        'salla_store_id',
        'salla_store_name',
        'ubiqfy_producttypecode',
        'sku_prefix',
      ];

      // Handle toggle switches - they send 'true' when on, nothing when off
      const updateData: Partial<SallaStore> = {
        salla_owner_name: body.salla_owner_name,
        salla_owner_email: body.salla_owner_email,
        salla_currency: body.salla_currency,
        currency_conversion_rate:
          parseFloat(body.currency_conversion_rate) || 3.75,
        ubiqfy_currency: body.ubiqfy_currency || 'USD',
        ubiqfy_username: body.ubiqfy_username,
        ubiqfy_terminal_key: body.ubiqfy_terminal_key,
        sync_status: body.sync_status,
        // Toggle switches: 'true' when on, undefined when off
        is_active: body.is_active === 'true',
        ubiqfy_sandbox: body.ubiqfy_sandbox === 'true',
      };

      // Only allow superadmins to update protected fields
      if (req.user.isSuperadmin) {
        updateData.salla_store_id = body.salla_store_id;
        updateData.salla_store_name = body.salla_store_name;
        updateData.ubiqfy_producttypecode = body.ubiqfy_producttypecode;
        updateData.sku_prefix = body.sku_prefix || 'UBQ';
      }

      // Don't update password if it's empty (keep existing password) - available to all users
      if (body.ubiqfy_password && body.ubiqfy_password.trim() !== '') {
        updateData.ubiqfy_password = body.ubiqfy_password;
      }

      await this.sallaStoresService.update(id, updateData);

      // For normal users, redirect to their store page. For superadmins, redirect to stores list
      if (req.user.isSuperadmin) {
        return res.redirect('/clients?success=store_updated');
      } else {
        return res.redirect(`/store?success=store_updated`);
      }
    } catch (error) {
      console.error('Error updating store:', error);
      return res.redirect(`/clients/edit/${id}?error=failed_to_update`);
    }
  }

  @Post('toggle-status/:id')
  @UseGuards(SuperAdminGuard)
  async toggleStoreStatus(@Param('id') id: string, @Res() res) {
    try {
      const updatedStore = await this.sallaStoresService.toggleActive(id);
      if (!updatedStore) {
        return res
          .status(404)
          .json({ success: false, error: 'Store not found' });
      }
      const action = updatedStore.is_active ? 'activated' : 'deactivated';
      return res.json({
        success: true,
        message: `Store ${action} successfully`,
        isActive: updatedStore.is_active,
      });
    } catch (error) {
      console.error('Error toggling store status:', error);
      return res
        .status(500)
        .json({ success: false, error: 'Failed to update store status' });
    }
  }
}
