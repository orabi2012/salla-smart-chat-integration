import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(ForbiddenException)
export class StoreAccessExceptionFilter implements ExceptionFilter {
  catch(exception: ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const message = exception.message;

    // Check if this is a web request (expects HTML) or API request (expects JSON)
    const acceptHeader = request.headers.accept || '';
    const isApiRequest =
      acceptHeader.includes('application/json') ||
      request.path.startsWith('/api/') ||
      request.path.startsWith('/salla-stores/');

    if (isApiRequest) {
      // Return JSON response for API requests
      response.status(status).json({
        statusCode: status,
        message: message,
        error: 'Forbidden',
      });
    } else {
      // Render error page for web requests
      let title = 'Access Denied';
      let errorMessage = message;

      if (message.includes('inactive')) {
        title = 'Store Inactive';
        errorMessage =
          'Your assigned store is currently inactive. Please contact an administrator for assistance.';
      } else if (message.includes('No store assigned')) {
        title = 'No Store Assigned';
        errorMessage =
          'No store has been assigned to your account. Please contact an administrator.';
      } else if (message.includes('Access denied to this store')) {
        title = 'Access Denied';
        errorMessage = 'You do not have permission to access this store.';
      }

      response.status(status).render('error', {
        title: title,
        message: errorMessage,
        user: request.user || { username: 'Unknown' },
        statusCode: status,
      });
    }
  }
}
