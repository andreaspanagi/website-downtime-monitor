// ============================================
// Link Checker Service
// Crawls website homepage and checks all links for broken links
// Broadcasts real-time progress updates via Socket.io
// ============================================

// Import required modules
const axios = require('axios');
const cheerio = require('cheerio');

// Import database models
const Link = require('../models/Link');

// ====================
// HELPER FUNCTIONS
// ====================

/**
 * Extract all links from HTML content
 * Parses HTML and finds all href attributes
 * @param {string} html - HTML content to parse
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {Array} Array of absolute URLs found in the page
 */
function extractLinksFromHTML(html, baseUrl) {
  // Create array to store links
  const links = [];
  
  try {
    // Parse HTML using cheerio (jQuery-like syntax)
    const $ = cheerio.load(html);
    
    // Find all anchor tags with href attribute
    $('a[href]').each((index, element) => {
      // Get the href value
      let href = $(element).attr('href');
      
      // Skip empty hrefs and fragments
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      // If href is relative, convert to absolute URL
      if (href.startsWith('/')) {
        // Relative path - prepend base domain
        try {
          const baseUrlObj = new URL(baseUrl);
          href = baseUrlObj.origin + href;
        } catch (e) {
          // Invalid base URL, skip
          return;
        }
      } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
        // Relative URL without slash - make absolute
        try {
          href = new URL(href, baseUrl).href;
        } catch (e) {
          // Invalid URL, skip
          return;
        }
      }
      
      // Add link to array if not already present
      if (!links.includes(href)) {
        links.push(href);
      }
    });
    
  } catch (error) {
    // Error parsing HTML
    console.error('Error extracting links from HTML:', error.message);
  }
  
  // Return deduplicated links array
  return links;
}

/**
 * Check a single link by making HTTP HEAD request
 * HEAD request is faster than GET (only checks headers, not body)
 * @param {string} url - URL to check
 * @returns {Object} Result with status, statusCode, error
 */
async function checkSingleLink(url) {
  try {
    // Try HEAD request first (faster, only gets headers)
    try {
      const response = await axios.head(url, {
        timeout: 5000, // 5 second timeout
        validateStatus: () => true // Accept all status codes
      });
      
      // Return result with status code
      return {
        status: response.status >= 200 && response.status < 400 ? 'working' : 'broken',
        statusCode: response.status,
        error: null
      };
    } catch (headError) {
      // If HEAD fails, try GET request (some servers don't support HEAD)
      const response = await axios.get(url, {
        timeout: 5000, // 5 second timeout
        validateStatus: () => true // Accept all status codes
      });
      
      // Return result with status code
      return {
        status: response.status >= 200 && response.status < 400 ? 'working' : 'broken',
        statusCode: response.status,
        error: null
      };
    }
    
  } catch (error) {
    // Extract error information
    let errorMessage = 'Connection failed';
    let statusCode = null;
    
    // Determine error type
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = `HTTP ${statusCode}`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Domain not found';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
    }
    
    // Return error result
    return {
      status: 'broken',
      statusCode: statusCode,
      error: errorMessage
    };
  }
}

// ====================
// SOCKET.IO BROADCAST FUNCTIONS
// ====================

/**
 * Broadcast link check progress to all connected clients
 * Updates dashboard with current progress (links checked/total)
 * @param {number} checked - Number of links checked so far
 * @param {number} total - Total number of links to check
 * @param {string} currentUrl - URL currently being checked
 */
function broadcastLinkProgress(checked, total, currentUrl) {
  // Check if Socket.io is available
  if (global.io) {
    // Emit progress event to all connected clients
    global.io.emit('linkCheckProgress', {
      checked: checked,
      total: total,
      percentage: Math.round((checked / total) * 100),
      currentUrl: currentUrl,
      timestamp: new Date()
    });
    
    // Log progress
    console.log(`📡 Broadcasting link check progress: ${checked}/${total}`);
  }
}

/**
 * Broadcast link check completion to all connected clients
 * Sends final results (working, broken, unchecked counts and details)
 * @param {Object} summary - Summary object with counts and link details
 */
function broadcastLinkCheckComplete(summary) {
  // Check if Socket.io is available
  if (global.io) {
    // Emit completion event to all connected clients
    global.io.emit('linkCheckCompleted', {
      summary: summary,
      timestamp: new Date()
    });
    
    // Log completion
    console.log(`📡 Broadcasting link check completion: ${summary.workingCount} working, ${summary.brokenCount} broken`);
  }
}

// ====================
// MAIN LINK CHECKING FUNCTION
// ====================

/**
 * Check all links on the website homepage
 * Crawls homepage, extracts all links, checks each one, saves results
 * Broadcasts progress and completion events via Socket.io
 * @param {Object} website - Website document from MongoDB
 */
async function checkAllLinks(website) {
  try {
    // Log link check start
    console.log(`\n🔗 Starting link check for ${website.url}...`);
    
    // Step 1: Fetch the homepage HTML
    console.log('Fetching homepage HTML...');
    const response = await axios.get(website.url, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    // Check if homepage fetch was successful
    if (response.status !== 200) {
      console.error(`Failed to fetch homepage: HTTP ${response.status}`);
      return {
        error: `Failed to fetch homepage: HTTP ${response.status}`
      };
    }
    
    // Step 2: Extract all links from HTML
    const links = extractLinksFromHTML(response.data, website.url);
    console.log(`Found ${links.length} links on homepage`);
    
    // Broadcast initial count to dashboard
    broadcastLinkProgress(0, links.length, 'Starting...');
    
    // Step 3: Check each link
    const results = {
      working: [],
      broken: [],
      checked: 0
    };
    
    // Check each link sequentially
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      
      // Check the link
      const checkResult = await checkSingleLink(link);
      
      // Increment checked count
      results.checked++;
      
      // Categorize the result
      if (checkResult.status === 'working') {
        results.working.push({
          url: link,
          statusCode: checkResult.statusCode
        });
      } else {
        results.broken.push({
          url: link,
          statusCode: checkResult.statusCode,
          error: checkResult.error
        });
      }
      
      // Broadcast progress every 5 links or at the end
      if (i % 5 === 0 || i === links.length - 1) {
        broadcastLinkProgress(results.checked, links.length, link);
      }
    }
    
    // Step 4: Save results to database
    console.log('Saving results to database...');
    
    // Clear old links for this website
    await Link.deleteMany({ website: website._id });
    
    // Save working links
    for (const link of results.working) {
      const linkDoc = new Link({
        website: website._id,
        url: link.url,
        status: 'working',
        statusCode: link.statusCode,
        errorMessage: null,
        lastChecked: new Date()
      });
      await linkDoc.save();
    }
    
    // Save broken links
    for (const link of results.broken) {
      const linkDoc = new Link({
        website: website._id,
        url: link.url,
        status: 'broken',
        statusCode: link.statusCode,
        errorMessage: link.error,
        lastChecked: new Date()
      });
      await linkDoc.save();
    }
    
    // Create summary object
    const summary = {
      workingCount: results.working.length,
      brokenCount: results.broken.length,
      totalCount: links.length,
      workingLinks: results.working,
      brokenLinks: results.broken,
      completedAt: new Date()
    };
    
    // Broadcast completion with results
    broadcastLinkCheckComplete(summary);
    
    // Log completion
    console.log(`✅ Link check completed: ${results.working.length} working, ${results.broken.length} broken\n`);
    
    // Return summary
    return summary;
    
  } catch (error) {
    // Handle any errors during link check
    console.error(`Error checking links for ${website.url}:`, error.message);
    
    return {
      error: error.message
    };
  }
}

// ====================
// EXPORTS
// ====================

// Export functions for use in routes
module.exports = {
  checkAllLinks,
  checkSingleLink,
  extractLinksFromHTML
};