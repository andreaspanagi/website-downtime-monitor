// ============================================
// Email Service (Gmail)
// Handles sending email notifications via Gmail SMTP
// ============================================

const nodemailer = require('nodemailer');

/**
 * Create and configure Gmail SMTP transporter
 * Uses credentials from .env file
 */
function createEmailTransporter() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.GMAIL_SMTP_USER, // Gmail email address
      pass: process.env.GMAIL_APP_KEY   // Gmail App Password
    }
  });

  return transporter;
}

/**
 * Send website down notification email
 * @param {Object} params - Email parameters
 * @param {string} params.websiteUrl - The URL of the website that went down
 * @param {number} params.statusCode - HTTP status code (if available)
 * @param {string} params.errorMessage - Error message describing what went wrong
 * @param {string} params.timestamp - When the incident occurred
 * @param {string} params.toEmail - Recipient email address
 */
async function sendWebsiteDownEmail({ websiteUrl, statusCode, errorMessage, timestamp, toEmail }) {
  try {
    // Validate required environment variables
    if (!process.env.GMAIL_SMTP_USER || !process.env.GMAIL_APP_KEY) {
      console.error('❌ Gmail SMTP credentials not configured in .env file');
      return { success: false, error: 'SMTP credentials missing' };
    }

    // Validate recipient email
    if (!toEmail) {
      console.error('❌ Recipient email address not provided');
      return { success: false, error: 'Recipient email missing' };
    }

    // Create transporter
    const transporter = createEmailTransporter();

    // Format timestamp for email
    const formattedTime = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Build email subject
    const subject = `🚨 ALERT: ${websiteUrl} is DOWN`;

    // Build HTML email body
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #dc3545;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f8f9fa;
              padding: 20px;
              border: 1px solid #dee2e6;
              border-top: none;
              border-radius: 0 0 5px 5px;
            }
            .alert-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .detail-row {
              margin: 10px 0;
              padding: 10px;
              background-color: white;
              border-left: 4px solid #dc3545;
            }
            .detail-label {
              font-weight: bold;
              color: #495057;
            }
            .detail-value {
              color: #212529;
              margin-left: 10px;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #dee2e6;
              font-size: 12px;
              color: #6c757d;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="alert-icon">🚨</div>
            <h1 style="margin: 0;">Website Down Alert</h1>
          </div>
          <div class="content">
            <p>Your monitored website has gone down and is currently unreachable.</p>
            
            <div class="detail-row">
              <span class="detail-label">🌐 Website:</span>
              <span class="detail-value"><strong>${websiteUrl}</strong></span>
            </div>
            
            ${statusCode ? `
            <div class="detail-row">
              <span class="detail-label">📊 Status Code:</span>
              <span class="detail-value">${statusCode}</span>
            </div>
            ` : ''}
            
            ${errorMessage ? `
            <div class="detail-row">
              <span class="detail-label">❌ Error:</span>
              <span class="detail-value">${errorMessage}</span>
            </div>
            ` : ''}
            
            <div class="detail-row">
              <span class="detail-label">⏰ Time:</span>
              <span class="detail-value">${formattedTime}</span>
            </div>
            
            <p style="margin-top: 20px;">
              <strong>Action Required:</strong> Please investigate the issue immediately to restore service.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated alert from your Website Monitor system.</p>
            <p>If you continue to receive these alerts, please check your monitoring configuration.</p>
          </div>
        </body>
      </html>
    `;

    // Build plain text version (fallback for email clients that don't support HTML)
    const textBody = `
WEBSITE DOWN ALERT
==================

Your monitored website has gone down and is currently unreachable.

Website: ${websiteUrl}
${statusCode ? `Status Code: ${statusCode}` : ''}
${errorMessage ? `Error: ${errorMessage}` : ''}
Time: ${formattedTime}

Action Required: Please investigate the issue immediately to restore service.

---
This is an automated alert from your Website Monitor system.
    `.trim();

    // Email options
    const mailOptions = {
      from: `"Website Monitor" <${process.env.GMAIL_SMTP_USER}>`,
      to: toEmail,
      subject: subject,
      text: textBody,
      html: htmlBody
    };

    // Send email
    console.log(`📧 Sending down alert email to ${toEmail} for ${websiteUrl}...`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error(`❌ Error sending email:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send website recovery notification email
 * @param {Object} params - Email parameters
 * @param {string} params.websiteUrl - The URL of the website that recovered
 * @param {string} params.downDuration - How long the site was down
 * @param {string} params.timestamp - When the recovery occurred
 * @param {string} params.toEmail - Recipient email address
 */
async function sendWebsiteUpEmail({ websiteUrl, downDuration, timestamp, toEmail }) {
  try {
    // Validate required environment variables
    if (!process.env.GMAIL_SMTP_USER || !process.env.GMAIL_APP_KEY) {
      console.error('❌ Gmail SMTP credentials not configured in .env file');
      return { success: false, error: 'SMTP credentials missing' };
    }

    // Validate recipient email
    if (!toEmail) {
      console.error('❌ Recipient email address not provided');
      return { success: false, error: 'Recipient email missing' };
    }

    // Create transporter
    const transporter = createEmailTransporter();

    // Format timestamp for email
    const formattedTime = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Build email subject
    const subject = `✅ RECOVERY: ${websiteUrl} is back UP`;

    // Build HTML email body
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #28a745;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f8f9fa;
              padding: 20px;
              border: 1px solid #dee2e6;
              border-top: none;
              border-radius: 0 0 5px 5px;
            }
            .alert-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
            .detail-row {
              margin: 10px 0;
              padding: 10px;
              background-color: white;
              border-left: 4px solid #28a745;
            }
            .detail-label {
              font-weight: bold;
              color: #495057;
            }
            .detail-value {
              color: #212529;
              margin-left: 10px;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #dee2e6;
              font-size: 12px;
              color: #6c757d;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="alert-icon">✅</div>
            <h1 style="margin: 0;">Website Recovery Notice</h1>
          </div>
          <div class="content">
            <p>Good news! Your monitored website is back online and responding normally.</p>
            
            <div class="detail-row">
              <span class="detail-label">🌐 Website:</span>
              <span class="detail-value"><strong>${websiteUrl}</strong></span>
            </div>
            
            ${downDuration ? `
            <div class="detail-row">
              <span class="detail-label">⏱️ Downtime:</span>
              <span class="detail-value">${downDuration}</span>
            </div>
            ` : ''}
            
            <div class="detail-row">
              <span class="detail-label">⏰ Recovery Time:</span>
              <span class="detail-value">${formattedTime}</span>
            </div>
            
            <p style="margin-top: 20px;">
              The website has been restored and is now accessible.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from your Website Monitor system.</p>
          </div>
        </body>
      </html>
    `;

    // Build plain text version
    const textBody = `
WEBSITE RECOVERY NOTICE
=======================

Good news! Your monitored website is back online and responding normally.

Website: ${websiteUrl}
${downDuration ? `Downtime: ${downDuration}` : ''}
Recovery Time: ${formattedTime}

The website has been restored and is now accessible.

---
This is an automated notification from your Website Monitor system.
    `.trim();

    // Email options
    const mailOptions = {
      from: `"Website Monitor" <${process.env.GMAIL_SMTP_USER}>`,
      to: toEmail,
      subject: subject,
      text: textBody,
      html: htmlBody
    };

    // Send email
    console.log(`📧 Sending recovery email to ${toEmail} for ${websiteUrl}...`);
    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error(`❌ Error sending email:`, error.message);
    return { success: false, error: error.message };
  }
}

// ====================
// EXPORTS
// ====================

module.exports = {
  sendWebsiteDownEmail,
  sendWebsiteUpEmail
};
