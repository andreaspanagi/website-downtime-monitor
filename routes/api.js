// API Routes
// Provides JSON endpoints for data access

const express = require('express');
const router = express.Router();
const Website = require('../models/Website');
const UptimeRecord = require('../models/UptimeRecord');
const Alert = require('../models/Alert');
const Link = require('../models/Link');

/**
 * GET /api/status
 * Get current website status
 */
router.get('/status', async (req, res) => {
  try {
    // Get the monitored website
    const website = await Website.findOne();
    
    // If no website configured
    if (!website) {
      return res.json({
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
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/websites/:id
 * Get a specific website by ID (for polling fallback)
 */
router.get('/websites/:id', async (req, res) => {
  try {
    const websiteId = req.params.id;
    
    // Find the website
    const website = await Website.findById(websiteId);
    
    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found'
      });
    }
    
    // Return website data
    res.json({
      success: true,
      data: {
        _id: website._id,
        url: website.url,
        currentStatus: website.currentStatus,
        lastChecked: website.lastChecked,
        lastResponseTime: website.lastResponseTime,
        lastStatusCode: website.lastStatusCode,
        isActive: website.isActive
      }
    });
    
  } catch (error) {
    console.error('Error getting website:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/uptime
 * Get uptime percentage for a time period
 * Query params: hours (default: 24)
 */
router.get('/uptime', async (req, res) => {
  try {
    // Get hours from query params or default to 24
    const hours = parseInt(req.query.hours) || 24;
    
    // Get the monitored website
    const website = await Website.findOne();
    
    // If no website configured
    if (!website) {
      return res.json({
        success: false,
        message: 'No website configured'
      });
    }
    
    // Calculate uptime percentage
    const uptimePercentage = await UptimeRecord.getUptimePercentage(website._id, hours);
    
    // Return uptime data
    res.json({
      success: true,
      data: {
        hours: hours,
        uptimePercentage: uptimePercentage
      }
    });
    
  } catch (error) {
    console.error('Error getting uptime:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/records
 * Get uptime records for a time period
 * Query params: hours (default: 24), limit (default: 100)
 */
router.get('/records', async (req, res) => {
  try {
    // Get query parameters
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;
    
    // Get the monitored website
    const website = await Website.findOne();
    
    // If no website configured
    if (!website) {
      return res.json({
        success: false,
        message: 'No website configured'
      });
    }
    
    // Get recent records
    const records = await UptimeRecord.getRecentRecords(website._id, hours, limit);
    
    // Return records
    res.json({
      success: true,
      data: {
        count: records.length,
        records: records
      }
    });
    
  } catch (error) {
    console.error('Error getting records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/alerts
 * Get recent alerts
 * Query params: limit (default: 10)
 */
router.get('/alerts', async (req, res) => {
  try {
    // Get limit from query params
    const limit = parseInt(req.query.limit) || 10;
    
    // Get the monitored website
    const website = await Website.findOne();
    
    // If no website configured
    if (!website) {
      return res.json({
        success: false,
        message: 'No website configured'
      });
    }
    
    // Get recent alerts
    const alerts = await Alert.getRecentAlerts(website._id, limit);
    
    // Return alerts
    res.json({
      success: true,
      data: {
        count: alerts.length,
        alerts: alerts
      }
    });
    
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/links
 * Get all links grouped by status
 */
router.get('/links', async (req, res) => {
  try {
    // Get the monitored website
    const website = await Website.findOne();
    
    // If no website configured
    if (!website) {
      return res.json({
        success: false,
        message: 'No website configured'
      });
    }
    
    // Get links grouped by status
    const linksByStatus = await Link.getLinksByStatus(website._id);
    
    // Return links data
    res.json({
      success: true,
      data: {
        working: linksByStatus.working.length,
        broken: linksByStatus.broken.length,
        unchecked: linksByStatus.unchecked.length,
        links: linksByStatus
      }
    });
    
  } catch (error) {
    console.error('Error getting links:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/alerts/acknowledge
 * Mark all alerts as acknowledged
 */
router.post('/alerts/acknowledge', async (req, res) => {
  try {
    // Get the monitored website
    const website = await Website.findOne();
    
    // If no website configured
    if (!website) {
      return res.json({
        success: false,
        message: 'No website configured'
      });
    }
    
    // Acknowledge all alerts
    const count = await Alert.acknowledgeAlerts(website._id);
    
    // Return success
    res.json({
      success: true,
      data: {
        acknowledged: count
      }
    });
    
  } catch (error) {
    console.error('Error acknowledging alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export the router
module.exports = router;
