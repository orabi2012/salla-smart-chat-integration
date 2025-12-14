import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  private isApiRequest(request: Request): boolean {
    const contentType = request.headers['content-type'] ?? '';
    const accept = request.headers['accept'] ?? '';

    if (
      contentType.includes('application/json') ||
      accept.includes('application/json') ||
      request.url.startsWith('/api/') ||
      request.xhr
    ) {
      return true;
    }

    const publicApiPatterns = [
      /^\/salla-stores\/[^/]+\/products(?:\/html)?/,
    ];

    return publicApiPatterns.some((pattern) => pattern.test(request.url));
  }

  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if it's an API request (JSON content type or Accept header)
    const isApiRequest = this.isApiRequest(request);

    if (isApiRequest) {
      const errorResponse = exception.getResponse();
      const payload: Record<string, any> =
        typeof errorResponse === 'string'
          ? { message: errorResponse }
          : { ...errorResponse };

      if (payload.statusCode === undefined) {
        payload.statusCode = HttpStatus.UNAUTHORIZED;
      }
      if (payload.redirectTo === undefined) {
        payload.redirectTo = '/auth/login';
      }

      response.status(HttpStatus.UNAUTHORIZED).json(payload);
    } else {
      // For web requests, redirect to login page
      response.redirect('/auth/login');
    }
  }
}

@Catch(HttpException)
export class GlobalExceptionFilter implements ExceptionFilter {
  private isApiRequest(request: Request): boolean {
    const contentType = request.headers['content-type'] ?? '';
    const accept = request.headers['accept'] ?? '';

    if (
      contentType.includes('application/json') ||
      accept.includes('application/json') ||
      request.url.startsWith('/api/') ||
      request.xhr
    ) {
      return true;
    }

    const publicApiPatterns = [
      /^\/salla-stores\/[^/]+\/products(?:\/html)?/,
    ];

    return publicApiPatterns.some((pattern) => pattern.test(request.url));
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const treatAsApi = this.isApiRequest(request);

    // Handle 401 Unauthorized specifically
    if (status === HttpStatus.UNAUTHORIZED) {
      if (treatAsApi) {
        const errorResponse = exception.getResponse();
        const payload: Record<string, any> =
          typeof errorResponse === 'string'
            ? { message: errorResponse }
            : { ...errorResponse };

        if (payload.statusCode === undefined) {
          payload.statusCode = status;
        }
        if (payload.redirectTo === undefined) {
          payload.redirectTo = '/auth/login';
        }

        response.status(status).json(payload);
      } else {
        response.redirect('/auth/login');
      }
    }
    // Handle 403 Forbidden specifically
    else if (status === HttpStatus.FORBIDDEN) {
      const message = exception.message;
      if (treatAsApi) {
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
    } else {
      // Handle other HTTP exceptions normally
      const errorResponse = exception.getResponse();
      response.status(status).json(errorResponse);
    }
  }
}
