import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Get,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SallaWebhookService } from './salla-webhook.service';

@Controller('salla-webhook')
export class SallaWebhookController {
  private readonly logger = new Logger(SallaWebhookController.name);

  constructor(private readonly sallaWebhookService: SallaWebhookService) {}

  /**
   * Handle Salla webhook events
   * POST /salla-webhook/handle
   */
  @Post('handle')
  async handleWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log('📨 Received Salla webhook');
    this.logger.debug('Webhook payload:', JSON.stringify(payload, null, 2));
    this.logger.debug('Webhook headers:', JSON.stringify(headers, null, 2));

    try {
      // Verify webhook signature if configured
      // await this.sallaWebhookService.verifyWebhookSignature(payload, headers);

      // Process the webhook based on event type
      const result = await this.sallaWebhookService.processWebhook(payload);

      return {
        success: true,
        message: 'Webhook processed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Webhook processing failed:', error.message);
      this.logger.error('Error stack:', error.stack);

      // Return 200 even on error to prevent Salla retries for invalid webhooks
      // But log the error for debugging
      return {
        success: false,
        message: 'Webhook processing failed',
        error: error.message,
      };
    }
  }

  /**
   * Display setup page for new installations
   * GET /salla-webhook/setup/:storeId
   */
  @Get('setup/:storeId')
  async showSetupPage(@Param('storeId') storeId: string, @Res() res: Response) {
    try {
      // Get store information
      const result = await this.sallaWebhookService.getStoreForSetup(storeId);

      // Generate setup page HTML
      const setupPageHtml = this.generateSetupPageHtml(result.store);

      res.setHeader('Content-Type', 'text/html');
      return res.send(setupPageHtml);
    } catch (error) {
      this.logger.error('❌ Setup page error:', error.message);

      const errorPageHtml = this.generateErrorPageHtml(error.message);
      res.setHeader('Content-Type', 'text/html');
      return res.send(errorPageHtml);
    }
  }

  /**
   * Complete Ubiqfy setup
   * POST /salla-webhook/setup/:storeId/complete
   */
  @Post('setup/:storeId/complete')
  async completeSetup(
    @Param('storeId') storeId: string,
    @Body()
    setupData: {
      ubiqfy_username: string;
      ubiqfy_password: string;
      ubiqfy_terminal_key: string;
      ubiqfy_sandbox: boolean;
      ubiqfy_plafond?: number;
    },
  ) {
    try {
      const result = await this.sallaWebhookService.completeUbiqfySetup(
        storeId,
        setupData,
      );

      return {
        success: true,
        message: 'Setup completed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Setup completion failed:', error.message);

      return {
        success: false,
        message: 'Setup failed',
        error: error.message,
      };
    }
  }

  /**
   * Test endpoint to verify webhook is working
   * GET /salla-webhook/test
   */
  @Post('test')
  async testWebhook(@Body() testPayload: any) {
    this.logger.log('🧪 Test webhook received');
    return {
      success: true,
      message: 'Webhook endpoint is working',
      receivedPayload: testPayload,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate setup page HTML
   */
  private generateSetupPageHtml(store: any): string {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعداد تطبيق Ubiqfy - ${store.salla_store_name}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .setup-container {
            max-width: 600px;
            margin: 50px auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .setup-header {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .setup-form {
            padding: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .btn-setup {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            border: none;
            padding: 12px 30px;
            font-size: 16px;
            border-radius: 25px;
            transition: all 0.3s ease;
        }
        .btn-setup:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .store-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .alert-custom {
            border-radius: 10px;
            border: none;
        }
    </style>
</head>
<body>
    <div class="setup-container">
        <div class="setup-header">
            <h1><i class="fas fa-cog"></i> مرحباً بك في Ubiqfy</h1>
            <p>أكمل إعداد متجرك للبدء في بيع المنتجات الرقمية</p>
        </div>
        
        <div class="setup-form">
            <div class="store-info">
                <h5><i class="fas fa-store"></i> معلومات المتجر</h5>
                <p><strong>اسم المتجر:</strong> ${store.salla_store_name}</p>
                <p><strong>المالك:</strong> ${store.salla_owner_name}</p>
                <p><strong>الإيميل:</strong> ${store.salla_owner_email}</p>
            </div>

            <div class="alert alert-info alert-custom">
                <i class="fas fa-info-circle"></i> 
                لإكمال الإعداد، نحتاج بيانات حساب Ubiqfy الخاص بك
            </div>

            <form id="setupForm">
                <div class="form-group">
                    <label for="ubiqfy_username" class="form-label">
                        <i class="fas fa-user"></i> اسم المستخدم Ubiqfy
                    </label>
                    <input type="text" class="form-control" id="ubiqfy_username" required>
                </div>

                <div class="form-group">
                    <label for="ubiqfy_password" class="form-label">
                        <i class="fas fa-key"></i> كلمة المرور Ubiqfy
                    </label>
                    <input type="password" class="form-control" id="ubiqfy_password" required>
                </div>

                <div class="form-group">
                    <label for="ubiqfy_terminal_key" class="form-label">
                        <i class="fas fa-terminal"></i> Terminal Key
                    </label>
                    <input type="text" class="form-control" id="ubiqfy_terminal_key" required>
                </div>

                <div class="form-group">
                    <label for="ubiqfy_plafond" class="form-label">
                        <i class="fas fa-wallet"></i> الحد الأقصى للرصيد (Plafond)
                    </label>
                    <input type="number" class="form-control" id="ubiqfy_plafond" min="0" step="0.01">
                </div>

                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="ubiqfy_sandbox" checked>
                    <label class="form-check-label" for="ubiqfy_sandbox">
                        <i class="fas fa-flask"></i> وضع التجربة (Sandbox Mode)
                    </label>
                </div>

                <div class="d-grid">
                    <button type="submit" class="btn btn-success btn-setup">
                        <i class="fas fa-rocket"></i> إكمال الإعداد وتفعيل المتجر
                    </button>
                </div>
            </form>

            <div id="setupStatus" class="mt-3"></div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        document.getElementById('setupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.querySelector('button[type="submit"]');
            const statusDiv = document.getElementById('setupStatus');
            
            // Show loading
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإعداد...';
            submitBtn.disabled = true;
            
            const formData = {
                ubiqfy_username: document.getElementById('ubiqfy_username').value,
                ubiqfy_password: document.getElementById('ubiqfy_password').value,
                ubiqfy_terminal_key: document.getElementById('ubiqfy_terminal_key').value,
                ubiqfy_plafond: parseFloat(document.getElementById('ubiqfy_plafond').value) || 0,
                ubiqfy_sandbox: document.getElementById('ubiqfy_sandbox').checked
            };
            
            try {
                const response = await fetch('/salla-webhook/setup/${store.id}/complete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    statusDiv.innerHTML = \`
                        <div class="alert alert-success alert-custom">
                            <i class="fas fa-check-circle"></i> 
                            تم الإعداد بنجاح! متجرك جاهز الآن لبيع المنتجات الرقمية.
                        </div>
                    \`;
                    
                    // Redirect to dashboard after success
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 2000);
                } else {
                    throw new Error(result.error || 'حدث خطأ أثناء الإعداد');
                }
            } catch (error) {
                statusDiv.innerHTML = \`
                    <div class="alert alert-danger alert-custom">
                        <i class="fas fa-exclamation-triangle"></i> 
                        حدث خطأ: \${error.message}
                    </div>
                \`;
                
                submitBtn.innerHTML = '<i class="fas fa-rocket"></i> إعادة المحاولة';
                submitBtn.disabled = false;
            }
        });
    </script>
</body>
</html>
        `;
  }

  /**
   * Generate error page HTML
   */
  private generateErrorPageHtml(error: string): string {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>خطأ في الإعداد</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body { 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .error-container {
            max-width: 500px;
            margin: 100px auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 40px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <i class="fas fa-exclamation-triangle text-danger" style="font-size: 64px;"></i>
        <h2 class="mt-3">حدث خطأ</h2>
        <p class="text-muted">${error}</p>
        <button onclick="history.back()" class="btn btn-primary">
            <i class="fas fa-arrow-right"></i> العودة
        </button>
    </div>
</body>
</html>
        `;
  }
}
