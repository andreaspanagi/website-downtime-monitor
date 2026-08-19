// ============================================
// Dashboard Routes
// Handles dashboard page views and manual check endpoints
// ============================================

// Import required modules
const express = require('express');
const router = express.Router();

// Import database models
const Website = require('../models/Website');
const UptimeRecord = require('../models/UptimeRecord');
const Alert = require('../models/Alert');
const Link = require('../models/Link');

// Import services
const { manualCheck } = require('../services/monitorService');
const { checkAllLinks } = require('../services/linkCheckerService');

// ====================
// DASHBOARD VIEW ROUTES
// ====================

/**
 * GET / - Main dashboard page
 * Displays the monitoring dashboard with status, history, and link checker
 */
router.get('/', async (req, res) => {
  try {
    // Get all active websites from database
    const websites = await Website.find({ isActive: true });
    
    // If no website exists, show setup page or error
    if (!websites || websites.length === 0) {
      return res.render('setup', { 
        message: 'No websites configured. Please set MONITOR_URLS in .env file.' 
      });
    }
    
    // Pre-compute website IDs for client-side use
    const websiteIds = websites.map(w => w._id.toString());
    
    // Render dashboard template with websites data
    res.render('dashboard', { 
      websites: websites,
      websiteIds: websiteIds
    });
    
  } catch (error) {
    // Log error and show error page
    console.error('Error loading dashboard:', error.message);
    res.status(500).render('error', { 
      message: 'Error loading dashboard' 
    });
  }
});

// ====================
// API ENDPOINTS FOR DASHBOARD
// ====================

/**
 * POST /api/manualCheck - Trigger manual uptime check
 * Immediately performs an uptime check without waiting for cron interval
 * Returns success status
 */
router.post('/api/manualCheck', async (req, res) => {
  try {
    // Log manual check request
    console.log('Manual check requested via API');
    
    // Trigger manual check (this will perform check and broadcast via Socket.io)
    await manualCheck();
    
    // Return success response
    res.json({ 
      success: true, 
      message: 'Manual check triggered' 
    });
    
  } catch (error) {
    // Log error and return error response
    console.error('Error triggering manual check:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error triggering manual check' 
    });
  }
});

/**
 * POST /api/checkLinks - Trigger link checking
 * Immediately crawls homepage and checks all links for broken links
 * Broadcasts progress and results via Socket.io
 */
router.post('/api/checkLinks', async (req, res) => {
  try {
    // Log link check request
    console.log('Link check requested via API');
    
    // Get the default website
    const website = await Website.findOne();
    
    // If no website found, return error
    if (!website) {
      return res.status(404).json({ 
        success: false, 
        message: 'No website configured' 
      });
    }
    
    // Trigger link check (this will check links and broadcast via Socket.io)
    // Use async/await without blocking response so user gets quick feedback
    checkAllLinks(website).catch(error => {
      console.error('Error during link check:', error.message);
    });
    
    // Return success response immediately (check happens in background)
    res.json({ 
      success: true, 
      message: 'Link check started' 
    });
    
  } catch (error) {
    // Log error and return error response
    console.error('Error triggering link check:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error triggering link check' 
    });
  }
});

/**
 * GET /api/status - Get current website status
 * Returns current status (up/down), last checked time, and response time
 */
router.get('/api/status', async (req, res) => {
  try {
    // Get the default website
    const website = await Website.findOne();
    
    // If no website found, return error
    if (!website) {
      return res.status(404).json({ 
        success: false, 
        message: 'No website configured' 
      });
    }
    
    // Return current status
    res.json({ 
      success: true, 
      data: {
        url: website.url,
        status: website.currentStatus,
        lastChecked: website.lastChecked
      }
    });
    
  } catch (error) {
    console.error('Error fetching status:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching status' 
    });
  }
});

/**
 * GET /api/records - Get uptime records
 * Returns check records for a specified time period
 * Query parameters: websiteId (optional), hours (default 24), limit (default 100)
 */
router.get('/api/records', async (req, res) => {
  try {
    // Get query parameters
    const websiteId = req.query.websiteId;
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    // Calculate date for time period
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Build query
    const query = { timestamp: { $gte: fromDate } };
    
    if (websiteId) {
      // Filter by specific website
      query.website = websiteId;
    } else {
      // Get the default website
      const website = await Website.findOne();
      if (!website) {
        return res.status(404).json({ 
          success: false, 
          message: 'No website configured' 
        });
      }
      query.website = website._id;
    }
    
    // Query records from database
    const records = await UptimeRecord.find(query)
      // Sort by timestamp descending (newest first)
      .sort({ timestamp: -1 })
      // Limit results
      .limit(limit)
      // Execute query
      .exec();
    
    // Return records
    res.json({ 
      success: true, 
      data: {
        count: records.length,
        records: records
      }
    });
    
  } catch (error) {
    console.error('Error fetching records:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching records' 
    });
  }
});

/**
 * GET /api/uptime - Get uptime percentage
 * Calculates uptime percentage for specified time period
 * Query parameters: hours (default 24)
 */
router.get('/api/uptime', async (req, res) => {
  try {
    // Get query parameters
    const hours = parseInt(req.query.hours) || 24;
    
    // Calculate date for time period
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get the default website
    const website = await Website.findOne();
    
    // If no website found, return error
    if (!website) {
      return res.status(404).json({ 
        success: false, 
        message: 'No website configured' 
      });
    }
    
    // Query all records in time period
    const records = await UptimeRecord.find({
      website: website._id,
      timestamp: { $gte: fromDate }
    });
    
    // If no records, return N/A
    if (records.length === 0) {
      return res.json({ 
        success: true, 
        data: {
          hours: hours,
          uptimePercentage: null,
          recordCount: 0
        }
      });
    }
    
    // Count "up" records
    const upCount = records.filter(r => r.status === 'up').length;
    
    // Calculate percentage
    const uptimePercentage = Math.round((upCount / records.length) * 100);
    
    // Return uptime percentage
    res.json({ 
      success: true, 
      data: {
        hours: hours,
        uptimePercentage: uptimePercentage,
        recordCount: records.length
      }
    });
    
  } catch (error) {
    console.error('Error calculating uptime:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error calculating uptime' 
    });
  }
});

/**
 * GET /api/alerts - Get recent alerts
 * Returns alerts ordered by newest first
 * Query parameters: limit (default 10)
 */
router.get('/api/alerts', async (req, res) => {
  try {
    // Get query parameters
    const limit = parseInt(req.query.limit) || 10;
    
    // Get the default website
    const website = await Website.findOne();
    
    // If no website found, return error
    if (!website) {
      return res.status(404).json({ 
        success: false, 
        message: 'No website configured' 
      });
    }
    
    // Query alerts from database
    const alerts = await Alert.find({
      website: website._id
    })
      // Sort by timestamp descending (newest first)
      .sort({ timestamp: -1 })
      // Limit results
      .limit(limit)
      // Execute query
      .exec();
    
    // Return alerts
    res.json({ 
      success: true, 
      data: {
        count: alerts.length,
        alerts: alerts
      }
    });
    
  } catch (error) {
    console.error('Error fetching alerts:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching alerts' 
    });
  }
});

/**
 * GET /api/links - Get all links with their status
 * Returns links grouped by status (working/broken/unchecked)
 */
router.get('/api/links', async (req, res) => {
  try {
    // Get the default website
    const website = await Website.findOne();
    
    // If no website found, return error
    if (!website) {
      return res.status(404).json({ 
        success: false, 
        message: 'No website configured' 
      });
    }
    
    // Query all links for this website
    const links = await Link.find({
      website: website._id
    });
    
    // Categorize links by status
    const working = links.filter(l => l.status === 'working');
    const broken = links.filter(l => l.status === 'broken');
    const unchecked = links.filter(l => l.status === 'unchecked');
    
    // Return categorized links
    res.json({ 
      success: true, 
      data: {
        workingCount: working.length,
        brokenCount: broken.length,
        uncheckedCount: unchecked.length,
        links: {
          working: working,
          broken: broken,
          unchecked: unchecked
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching links:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching links' 
    });
  }
});

/**
 * POST /api/alerts/acknowledge - Mark all alerts as acknowledged
 * Sets the acknowledged flag on all alerts for the website
 */
router.post('/api/alerts/acknowledge', async (req, res) => {
  try {
    // Get the default website
    const website = await Website.findOne();
    
    // If no website found, return error
    if (!website) {
      return res.status(404).json({ 
        success: false, 
        message: 'No website configured' 
      });
    }
    
    // Update all unacknowledged alerts for this website
    const result = await Alert.updateMany(
      { 
        website: website._id,
        acknowledged: false 
      },
      { 
        acknowledged: true 
      }
    );
    
    // Return result
    res.json({ 
      success: true, 
      data: {
        updatedCount: result.modifiedCount
      }
    });
    
  } catch (error) {
    console.error('Error acknowledging alerts:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error acknowledging alerts' 
    });
  }
});

// ====================
// EXPORTS
// ====================

// Export router for use in server.js
module.exports = router;