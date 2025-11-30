import { Controller, Get, UseGuards, Request, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SallaStoresService } from '../salla-stores/salla-stores.service';

@Controller('store')
@UseGuards(AuthGuard('jwt'))
export class StoreController {
  constructor(private readonly sallaStoresService: SallaStoresService) {}

  @Get()
  async getStore(@Request() req, @Res() res) {
    // If user is superadmin, redirect to clients page
    if (req.user.isSuperadmin) {
      return res.redirect('/clients');
    }

    // If user has no assigned store, show error
    if (!req.user.assignedStoreId) {
      return res.render('error', {
        title: 'No Store Assigned',
        message:
          'No store has been assigned to your account. Please contact an administrator.',
        user: req.user,
      });
    }

    // Check if the assigned store is active
    try {
      const store = await this.sallaStoresService.findById(
        req.user.assignedStoreId,
      );
      if (!store) {
        return res.render('error', {
          title: 'Store Not Found',
          message:
            'Your assigned store could not be found. Please contact an administrator.',
          user: req.user,
        });
      }

      if (!store.is_active) {
        return res.render('error', {
          title: 'Store Inactive',
          message:
            'Your assigned store is currently inactive. Please contact an administrator for assistance.',
          user: req.user,
        });
      }
    } catch (error) {
      console.error('Error checking store status:', error);
      return res.render('error', {
        title: 'System Error',
        message:
          'Unable to verify store access. Please try again later or contact an administrator.',
        user: req.user,
      });
    }

    // Redirect to the existing clients/edit page with the user's assigned store
    return res.redirect(`/clients/edit/${req.user.assignedStoreId}`);
  }
}
