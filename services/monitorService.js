// ============================================
// Monitor Service
// Handles periodic website uptime checks using HTTP requests and cron scheduling
// Emits real-time updates via Socket.io to all connected clients
// ============================================

// Import required modules
const cron = require('node-cron');
const axios = require('axios');

// Import database models
const Website = require('../models/Website');
const UptimeRecord = require('../models/UptimeRecord');
const Alert = require('../models/Alert');

// Import email service
const { sendWebsiteDownEmail, sendWebsiteUpEmail } = require('./emailService');

// ====================
// UPTIME CHECK FUNCTIONS
// ====================

/**
 * Perform a single uptime check for a website
 * Makes an HTTP GET request and measures response time
 * @param {Object} website - The website document from MongoDB
 * @returns {Object} Check result with status, statusCode, responseTime, and error
 */
async function performUptimeCheck(website) {
  // Record the start time to calculate response time
  const startTime = Date.now();
  
  try {
    // Perform HTTP GET request to the website
    // Set a 10 second timeout to avoid hanging on slow sites
    const response = await axios.get(website.url, {
      timeout: 10000, // 10 seconds
      // Accept status codes below 500 as successful responses
      validateStatus: (status) => status < 500
    });
    
    // Calculate response time in milliseconds
    const responseTime = Date.now() - startTime;
    
    // Determine if the site is up based on status code
    // Status codes 200-499 are considered "up" (including redirects and client errors)
    // Status codes 500+ are considered "down" (server errors)
    const isUp = response.status >= 200 && response.status < 500;
    
    // Log the check result
    console.log(`✓ Check completed for ${website.url}: ${response.status} (${responseTime}ms)`);
    
    // Return the check result object
    return {
      status: isUp ? 'up' : 'down',
      statusCode: response.status,
      responseTime: responseTime,
      error: null
    };
    
  } catch (error) {
    // Calculate response time even on error
    const responseTime = Date.now() - startTime;
    
    // Extract meaningful error information from the error object
    let errorMessage = 'Unknown error';
    let statusCode = null;
    
    // Check what type of error occurred and set appropriate message
    if (error.response) {
      // Server responded with error status code (5xx)
      statusCode = error.response.status;
      errorMessage = `HTTP ${statusCode}`;
    } else if (error.code === 'ENOTFOUND') {
      // DNS lookup failed - domain doesn't exist
      errorMessage = 'Domain not found';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      // Request timed out after 10 seconds
      errorMessage = 'Request timeout';
    } else if (error.code === 'ECONNREFUSED') {
      // Connection refused by server
      errorMessage = 'Connection refused';
    } else {
      // Other errors (network issues, etc)
      errorMessage = error.message || 'Connection failed';
    }
    
    // Log the error
    console.log(`✗ Check failed for ${website.url}: ${errorMessage}`);
    
    // Return the error result
    return {
      status: 'down',
      statusCode: statusCode,
      responseTime: responseTime,
      error: errorMessage
    };
  }
}

// ====================
// SOCKET.IO BROADCAST FUNCTIONS
// ====================

/**
 * Emit check result to all connected clients via WebSocket
 * Allows dashboard to update in real-time without page refresh
 * @param {Object} website - The website document
 * @param {Object} checkResult - The check result from performUptimeCheck
 */
function broadcastCheckResult(website, checkResult) {
  // Check if Socket.io is available (initialized in server.js as global.io)
  if (global.io) {
    // Emit the check result to ALL connected clients
    global.io.emit('checkCompleted', {
      // Include website information
      website: {
        id: website._id,
        url: website.url,
        currentStatus: checkResult.status
      },
      // Include check result details
      checkResult: {
        status: checkResult.status,
        statusCode: checkResult.statusCode,
        responseTime: checkResult.responseTime,
        error: checkResult.error,
        timestamp: new Date()
      }
    });
    
    // Log that the event was broadcast
    console.log(`📡 Broadcasting check result to all clients for ${website.url}`);
  }
}

/**
 * Emit alert to all connected clients when website status changes
 * Allows dashboard to show status change notifications
 * @param {Object} website - The website document
 * @param {Object} alert - The alert object created from status change
 */
function broadcastAlert(website, alert) {
  // Check if Socket.io is available
  if (global.io) {
    // Emit the alert to ALL connected clients
    global.io.emit('alertTriggered', {
      website: website.url,
      event: alert.event,
      previousStatus: alert.previousStatus,
      newStatus: alert.newStatus,
      statusCode: alert.statusCode,
      errorMessage: alert.errorMessage,
      timestamp: alert.timestamp
    });
    
    // Log that the alert was broadcast
    console.log(`📡 Broadcasting alert to all clients: ${website.url} - ${alert.event}`);
  }
}

// ====================
// DATABASE SAVE FUNCTIONS
// ====================

/**
 * Save the check result to database and create alert if status changed
 * Updates website status and triggers broadcasts if needed
 * @param {Object} website - The website document from MongoDB
 * @param {Object} checkResult - Result from performUptimeCheck
 */
async function saveCheckResult(website, checkResult) {
  try {
    // Create new uptime record with check result data
    const uptimeRecord = new UptimeRecord({
      website: website._id,
      status: checkResult.status,
      statusCode: checkResult.statusCode,
      responseTime: checkResult.responseTime,
      errorMessage: checkResult.error,
      timestamp: new Date()
    });
    
    // Save the uptime record to database
    await uptimeRecord.save();
    
    // BROADCAST the check result to all connected dashboard clients
    broadcastCheckResult(website, checkResult);
    
    // Get the previous status before updating
    const previousStatus = website.currentStatus;
    const newStatus = checkResult.status;
    
    // Determine if we should send an alert:
    // 1. Status changed from up to down or down to up
    // 2. First check (unknown) and site is down - alert immediately
    const shouldAlert = (previousStatus !== newStatus && previousStatus !== 'unknown') ||
                        (previousStatus === 'unknown' && newStatus === 'down');
    
    if (shouldAlert) {
      // Determine the event type based on new status
      // 'down' means the website went down, 'up' means it came back up
      const event = newStatus === 'down' ? 'down' : 'up';
      
      // Create new alert document
      const alert = new Alert({
        website: website._id,
        event: event,
        previousStatus: previousStatus,
        newStatus: newStatus,
        statusCode: checkResult.statusCode,
        errorMessage: checkResult.error,
        timestamp: new Date()
      });
      
      // Save the alert to database
      await alert.save();
      
      // BROADCAST the alert to all connected clients
      broadcastAlert(website, alert);
      
      // Log the alert
      console.log(`🚨 ALERT: ${website.url} changed from ${previousStatus} to ${newStatus}`);
      
      // SEND EMAIL NOTIFICATION
      const alertEmail = process.env.ALERT_EMAIL;
      if (alertEmail) {
        if (event === 'down') {
          // Website went down - send down notification
          await sendWebsiteDownEmail({
            websiteUrl: website.url,
            statusCode: checkResult.statusCode,
            errorMessage: checkResult.error,
            timestamp: alert.timestamp,
            toEmail: alertEmail
          });
        } else {
          // Website came back up - send recovery notification
          // Calculate downtime duration if possible
          const lastDownAlert = await Alert.findOne({
            website: website._id,
            event: 'down'
          }).sort({ timestamp: -1 });
          
          let downDuration = null;
          if (lastDownAlert) {
            const downTime = new Date(alert.timestamp) - new Date(lastDownAlert.timestamp);
            const minutes = Math.floor(downTime / 60000);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) {
              downDuration = `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${(minutes % 60) !== 1 ? 's' : ''}`;
            } else {
              downDuration = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
          }
          
          await sendWebsiteUpEmail({
            websiteUrl: website.url,
            downDuration: downDuration,
            timestamp: alert.timestamp,
            toEmail: alertEmail
          });
        }
      } else {
        console.log('⚠️  ALERT_EMAIL not configured - skipping email notification');
      }
    }
    
    // Update website's current status and last checked timestamp
    website.currentStatus = newStatus;
    website.lastChecked = new Date();
    await website.save();
    
  } catch (error) {
    console.error(`Error saving check result for ${website.url}:`, error.message);
  }
}

// ====================
// MAIN MONITORING FUNCTIONS
// ====================

/**
 * Check all active websites in the database
 * Called by the cron job every check interval
 * Performs checks and saves results for each active website
 */
async function checkAllWebsites() {
  try {
    // Find all active websites in the database
    const websites = await Website.find({ isActive: true });
    
    // Log the number of websites to check
    console.log(`\n⏰ Starting uptime check for ${websites.length} website(s)...`);
    
    // If no websites to check, return early
    if (websites.length === 0) {
      console.log('No active websites to monitor.');
      return;
    }
    
    // Check each website
    for (const website of websites) {
      // Perform the uptime check for this website
      const checkResult = await performUptimeCheck(website);
      
      // Save the result to database and broadcast via Socket.io
      await saveCheckResult(website, checkResult);
    }
    
    console.log('✅ Uptime check completed for all websites.\n');
    
  } catch (error) {
    console.error('Error checking websites:', error.message);
  }
}

/**
 * Initialize the monitoring service with cron scheduling
 * Starts periodic checks based on the interval specified in environment
 * Also runs an initial check when the service starts
 */
function startMonitoring() {
  // Get check interval from environment or default to 5 minutes
  const checkIntervalMinutes = process.env.CHECK_INTERVAL || 5;
  
  // Log monitoring start
  console.log(`\n🔍 Monitoring service started - checking every ${checkIntervalMinutes} minute(s)`);
  
  // Create cron expression for the interval
  // Format: */N * * * * means "every N minutes"
  const cronExpression = `*/${checkIntervalMinutes} * * * *`;
  
  // Schedule the cron job to run at the specified interval
  const task = cron.schedule(cronExpression, () => {
    // When cron fires, run all website checks
    checkAllWebsites();
  });
  
  // Run an initial check immediately when service starts
  // This ensures we don't have to wait for the first cron interval to see results
  console.log('Running initial check...');
  
  // Use setTimeout to wait 5 seconds before initial check
  // This allows the database to fully initialize first
  setTimeout(() => {
    checkAllWebsites();
  }, 5000); // Wait 5 seconds
  
  // Return the cron task for potential stopping later
  return task;
}

/**
 * Manually trigger a check (useful for testing or on-demand checks)
 * Can be called from API endpoint
 */
async function manualCheck() {
  console.log('Manual check triggered...');
  await checkAllWebsites();
}

// ====================
// EXPORTS
// ====================

// Export all functions for use in server.js and API routes
module.exports = {
  startMonitoring,
  checkAllWebsites,
  manualCheck,
  performUptimeCheck,
  broadcastCheckResult,
  broadcastAlert
};