import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SallaStoresService } from '../salla-stores/salla-stores.service';

@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private sallaStoresService: SallaStoresService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('StoreAccessGuard - User:', JSON.stringify(user, null, 2));

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super admins have access to all stores (even inactive ones for management)
    if (user.isSuperadmin) {
      console.log('StoreAccessGuard - Superadmin access granted');
      return true;
    }

    // Regular users must have an assigned store
    if (!user.assignedStoreId) {
      console.log('StoreAccessGuard - No assignedStoreId for user');
      throw new ForbiddenException('No store assigned to this user');
    }

    // Check if the assigned store is active
    try {
      const store = await this.sallaStoresService.findById(
        user.assignedStoreId,
      );
      if (!store) {
        console.log('StoreAccessGuard - Assigned store not found');
        throw new ForbiddenException('Assigned store not found');
      }

      if (!store.is_active) {
        console.log('StoreAccessGuard - Assigned store is inactive');
        throw new ForbiddenException(
          'Your assigned store is currently inactive. Please contact an administrator.',
        );
      }
    } catch (error) {
      console.log(
        'StoreAccessGuard - Error checking store status:',
        error.message,
      );
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify store access');
    }

    // Safely check if the requested store ID matches the user's assigned store
    // Look for storeId in params (could be 'id', 'storeId', etc.)
    const params = request.params || {};
    const query = request.query || {};
    const body = request.body || {};

    let storeId =
      params.id || params.storeId || query.storeId || body.storeId;

    const sallaStoreId =
      params.sallaStoreId || query.sallaStoreId || body.sallaStoreId;

    if (!storeId && sallaStoreId) {
      try {
        const store = await this.sallaStoresService.findBySallaStoreId(
          sallaStoreId,
        );

        if (!store) {
          console.log(
            'StoreAccessGuard - Salla store ID not found in system:',
            sallaStoreId,
          );
          throw new ForbiddenException('Access denied to this store');
        }

        storeId = store.id;
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        console.log(
          'StoreAccessGuard - Error resolving Salla store ID:',
          error.message,
        );
        throw new ForbiddenException('Unable to verify store access');
      }
    }

    console.log('StoreAccessGuard - Store ID param:', storeId);

    // If no storeId is provided in the request, allow access for regular users
    // (they can only access their assigned store anyway)
    if (!storeId) {
      console.log(
        'StoreAccessGuard - No store ID in request, allowing access to assigned store',
      );
      return true;
    }

    // If storeId is provided, verify it matches the user's assigned store
    if (storeId !== user.assignedStoreId) {
      console.log(
        `StoreAccessGuard - Access denied. User assigned to ${user.assignedStoreId}, requested ${storeId}`,
      );
      throw new ForbiddenException('Access denied to this store');
    }

    console.log('StoreAccessGuard - Access granted for normal user');
    return true;
  }
}
