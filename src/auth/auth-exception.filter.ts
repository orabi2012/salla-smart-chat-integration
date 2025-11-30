import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
  ForbiddenException,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if it's an API request (JSON content type or Accept header)
    const isApiRequest =
      request.headers['content-type']?.includes('application/json') ||
      request.headers['accept']?.includes('application/json') ||
      request.url.startsWith('/api/') ||
      request.xhr; // XMLHttpRequest

    if (isApiRequest) {
      // For API requests, return JSON response
      response.status(HttpStatus.UNAUTHORIZED).json({
        message: 'Unauthorized',
        statusCode: 401,
        redirectTo: '/auth/login',
      });
    } else {
      // For web requests, redirect to login page
      response.redirect('/auth/login');
    }
  }
}

@Catch(HttpException)
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Handle 401 Unauthorized specifically
    if (status === HttpStatus.UNAUTHORIZED) {
      const isApiRequest =
        request.headers['content-type']?.includes('application/json') ||
        request.headers['accept']?.includes('application/json') ||
        request.url.startsWith('/api/') ||
        request.xhr;

      if (isApiRequest) {
        response.status(status).json({
          message: 'Unauthorized',
          statusCode: 401,
          redirectTo: '/auth/login',
        });
      } else {
        response.redirect('/auth/login');
      }
    }
    // Handle 403 Forbidden specifically
    else if (status === HttpStatus.FORBIDDEN) {
      const message = exception.message;
      const isApiRequest =
        request.headers['content-type']?.includes('application/json') ||
        request.headers['accept']?.includes('application/json') ||
        request.url.startsWith('/api/') ||
        request.url.startsWith('/salla-stores/') ||
        request.xhr;

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
    } else {
      // Handle other HTTP exceptions normally
      const errorResponse = exception.getResponse();
      response.status(status).json(errorResponse);
    }
  }
}
