# Salla-Ubiqfy Integration User Manual

<p align="center">
  <img src="public/images/ubiqfy_logo.jpg" width="200" alt="Ubiqfy Logo" />
</p>

<p align="center">
  <strong>Comprehensive guide for managing your Salla-Ubiqfy integration platform</strong>
</p>

## Table of Contents
1. [Getting Started](#getting-started)
2. [Store Settings](#store-settings)
3. [Purchase Orders](#purchase-orders)
4. [Analytics & Reporting](#analytics--reporting)
5. [Webhook Management](#webhook-management)
6. [Troubleshooting](#troubleshooting)
7. [Support](#support)

---

## Getting Started

### Application Overview
The Salla-Ubiqfy Integration Platform is a comprehensive solution that bridges Salla e-commerce stores with Ubiqfy's voucher services. This platform enables seamless:

- **Automated Integration**: OAuth-based connection with Salla stores
- **Store Insights**: Real-time access to Salla store and product information
- **Voucher Management**: Complete lifecycle management of digital vouchers
- **Order Processing**: Streamlined purchase order workflow
- **Financial Tracking**: Detailed reporting and invoice generation

### Logging In
1. Navigate to the login page at your platform URL
2. Enter your assigned username and password
3. Click the "Sign In" button with the arrow icon
4. Upon successful authentication, you'll be redirected to your dashboard

### User Interface Overview
The platform features a modern, responsive interface with:
- **Intuitive Navigation**: Easy access to all major functions
- **Real-time Updates**: Live status indicators and notifications
- **Multi-device Support**: Optimized for desktop, tablet, and mobile devices

---

## Store Settings

### Initial Setup
After installation from the Salla App Store, the system automatically:

1. **Receives Installation Webhook**: Salla sends app installation notification
2. **Creates Store Record**: System establishes your store profile
3. **Handles Authorization**: Automatically processes OAuth tokens
4. **Registers Webhooks**: Sets up event listeners for real-time updates

### Ubiqfy Configuration
Complete your integration by providing:

- **Username**: Your Ubiqfy account username
- **Password**: Secure password for API access  
- **Terminal Key**: Unique identifier for your terminal
- **Environment**: Choose between Sandbox (testing) or Production

### Store Status Monitoring
Monitor your integration health through:
- **Connection Status**: Real-time API connectivity indicator
- **Token Validity**: OAuth token expiration tracking
- **Webhook Status**: Event processing health check
- **Account Balance**: Current Ubiqfy account funds

---

## Purchase Orders

Purchase orders allow you to purchase vouchers from Ubiqfy when your stock runs low.

### Accessing Purchase Orders
1. Click "Purchase Orders" from the navigation menu
2. Or open the store dashboard and select "Create Purchase Order"

### Purchase Order Workflow

#### 1. Creating a New Order
1. **Start New Order**:
   - Click "Create Order" or "Create Purchase Order"
   - System creates a draft order with a unique order number

2. **Add Items**:
   - Select products from your available inventory
   - Specify quantities needed
   - Review unit prices and totals
   - Items are automatically added to the order

#### 2. Order Management
1. **View Order Details**:
   - Order number and status
   - Creation date and time
   - Total cost breakdown
   - Item list with quantities and prices

2. **Edit Orders** (Draft/Pending status only):
   - Modify quantities using +/- buttons or direct input
   - Remove items by clicking the × button
   - Add additional items as needed

3. **Order Status Types**:
   - **DRAFT**: Editable, not yet submitted
   - **PENDING**: Submitted, awaiting processing
   - **PROCESSING**: Currently being processed by Ubiqfy
   - **COMPLETED**: Successfully processed
   - **FAILED**: Processing failed
   - **CANCELLED**: Order was cancelled

#### 3. Order Processing
1. **Check Balance**:
   - System verifies sufficient account balance
   - Shows required amount vs. available balance
   - Displays currency conversion if applicable

2. **Confirm Order**:
   - Click "Confirm Order" to proceed with purchase
   - System performs balance check and processes payment
   - Order status changes to PROCESSING

3. **Monitor Progress**:
   - View real-time processing status
   - Track voucher generation progress
   - Receive notifications for completion or errors

### Order Actions
- **View Details**: See complete order information
- **Edit**: Modify draft or pending orders
- **Delete**: Remove draft orders (cannot delete processed orders)
- **Generate Invoice**: Create invoice for completed orders
- **Retry Failed**: Retry failed voucher transactions

---

## Invoices

Invoices provide detailed records of completed purchase orders and generated vouchers.

### Accessing Invoices
1. **From Purchase Orders**:
   - Click "View Invoice" on completed orders
   - Or click the invoice icon in the order list

2. **Direct Access**:
   - Navigate to completed purchase orders
   - Look for "Generate Invoice" button

### Invoice Information
Invoices display comprehensive information including:

#### Order Summary
- **Order Number**: Unique purchase order identifier
- **Date**: Invoice generation date
- **Store Information**: Salla store details
- **Status**: Completion status and statistics

#### Voucher Details
- **Successful Vouchers**: Count and total value
- **Success Rate**: Percentage of successful voucher generation
- **Total Amount**: Complete cost breakdown

#### Detailed Voucher List
For each successfully generated voucher:
- **External ID**: Salla product reference
- **Amount**: Voucher face value and wholesale cost
- **Serial Number**: Unique voucher identifier
- **Transaction ID**: Ubiqfy transaction reference
- **Reference**: Additional reference information
- **Product Option Code**: Ubiqfy product code

### Invoice Actions
1. **Print Invoice**:
   - Click "Print Invoice" to open print dialog
   - System formats invoice for optimal printing

2. **Download PDF** (if available):
   - Generate PDF version of the invoice
   - Save for record keeping

3. **Export Data**:
   - Copy voucher information to clipboard
   - Export for integration with other systems

---

## Troubleshooting

### Common Issues and Solutions

#### Order Processing Problems
**Issue**: Vouchers not generating
**Solutions**:
1. Check Ubiqfy API connectivity
2. Verify product codes and availability
3. Ensure sufficient account balance
4. Review failed voucher details for specific errors

**Issue**: Order stuck in PROCESSING status
**Solutions**:
1. Wait for processing to complete (may take several minutes)
2. Check order details for progress updates
3. Contact administrator if stuck for extended periods
4. Use "Retry Failed" option if some vouchers failed

### Getting Help
1. **Error Messages**: Always read error messages carefully - they often contain specific information about the problem
2. **Status Indicators**: Pay attention to color-coded status indicators throughout the system
3. **Refresh Data**: Many issues can be resolved by refreshing data or reloading the page
4. **Administrator Contact**: For persistent issues, contact your system administrator with:
   - Screenshots of error messages
   - Order numbers or IDs
   - Steps taken to reproduce the issue
   - Time when the problem occurred

### Best Practices
1. **Regular Monitoring**: Review store status indicators and recent purchase orders frequently
2. **Balance Management**: Monitor your Ubiqfy account balance to avoid failed orders
3. **Order Planning**: Plan purchase orders in advance to avoid fulfillment delays
4. **Record Keeping**: Download and save invoices for accounting purposes
5. **Testing**: Test small orders first when setting up new products

---

## System Requirements

### Browser Compatibility
- Modern web browsers (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Cookies enabled for session management

### Network Requirements
- Stable internet connection
- Access to Ubiqfy API endpoints
- Access to Salla API endpoints

### User Permissions
- Valid user account with store assignment
- Appropriate permissions for your role
- Active store status

---

## Glossary

**Salla**: E-commerce platform where your store is hosted  
**Ubiqfy**: Voucher provider platform for purchasing digital vouchers  
**Purchase Order**: Request to purchase vouchers from Ubiqfy  
**Invoice**: Detailed record of completed voucher purchases  
**Face Value**: The value of a voucher as seen by end customers  
**Wholesale Price**: The cost you pay to purchase vouchers from Ubiqfy  
**Product Option**: Specific variations or denominations of a product  
**External ID**: Unique identifier linking Salla products to Ubiqfy vouchers

---

## Support

### Technical Support
For technical assistance, bug reports, or feature requests:

📧 **Email Support**: [aorabi@outlook.com](mailto:aorabi@outlook.com)

### When Contacting Support
Please include the following information:
- Your store name/ID
- Description of the issue
- Steps to reproduce the problem
- Screenshots (if applicable)
- Error messages (exact text)
- Browser and version
- Date and time the issue occurred

### Response Times
- **Critical Issues** (system down, unable to process orders): 4-6 hours
- **High Priority** (functionality impaired): 24-48 hours  
- **Medium Priority** (minor bugs, feature requests): 3-5 business days
- **Low Priority** (documentation, general questions): 5-7 business days

### Additional Resources
- **GitHub Repository**: For developers and advanced users
- **System Status**: Check for known issues and maintenance schedules
- **Feature Roadmap**: View planned enhancements and updates

### Feedback
We value your feedback! Please share:
- Suggestions for new features
- Improvements to existing functionality
- User experience feedback
- Documentation enhancement requests

### Training and Onboarding
Contact support to arrange:
- New user training sessions
- Advanced feature workshops
- Custom integration consultations
- Best practices guidance

---

*Last updated: September 2025*  
*Version: 2.0*