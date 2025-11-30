import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SallaOAuthService {
  private readonly SALLA_AUTH_BASE = process.env.SALLA_AUTH_BASE || 'https://accounts.salla.sa/oauth2';
  private readonly SALLA_BASE_URL: string;

  constructor(private configService: ConfigService) {
    this.SALLA_BASE_URL =
      this.configService.get<string>('SALLA_BASE_URL') ||
      process.env.SALLA_BASE_URL || 'https://api.salla.dev/admin/v2';
  }

  /**
   * Generate authorization URL for manual OAuth flow
   * Now takes client credentials as parameters
   */
  generateAuthUrl(clientId: string, state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: 'http://localhost:3000/oauth/callback', // This won't work but shows the code
      scope: 'offline_access', // For refresh tokens
      state: state || 'local-dev',
    });

    return `${this.SALLA_AUTH_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * Now takes client credentials as parameters
   */
  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    try {
      const response = await axios.post(
        `${this.SALLA_AUTH_BASE}/token`,
        {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: 'http://localhost:3000/oauth/callback',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Token exchange failed:', error.response?.data);
      throw new Error(
        `Token exchange failed: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  /**
   * Refresh access token using refresh token
   * Now takes client credentials as parameters
   */
  async refreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    try {
      const response = await axios.post(
        `${this.SALLA_AUTH_BASE}/token`,
        {
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error('Token refresh failed:', error.response?.data);
      throw new Error(
        `Token refresh failed: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  /**
   * Generate instructions for manual token generation
   * For development purposes - requires client ID
   */
  getDevInstructions(clientId: string): {
    authUrl: string;
    instructions: string[];
  } {
    const authUrl = this.generateAuthUrl(clientId);

    return {
      authUrl,
      instructions: [
        '1. Open the authorization URL in your browser',
        '2. Login to your Salla account and authorize the app',
        "3. You'll be redirected to localhost (which will fail)",
        '4. Copy the "code" parameter from the failed URL',
        '5. Use the code with /dev/exchange-token endpoint',
        '6. Copy the returned access_token to your store form',
        '',
        'Example failed redirect URL:',
        'http://localhost:3000/oauth/callback?code=ABC123&state=local-dev',
        '',
        'Copy "ABC123" and exchange it for tokens',
      ],
    };
  }
}
