// ============================================
// Server.js - Main Express Application Entry Point
// Initializes the Express server, connects to MongoDB, starts monitoring, and sets up Socket.io
// ============================================

// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Import database connection
const connectDB = require('./config/db');

// Import monitoring service
const { startMonitoring } = require('./services/monitorService');

// Import routes
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');

// Create Express application
const app = express();

// Create HTTP server (required for Socket.io to work)
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server
const io = socketIo(server, {
  // Enable CORS to allow connections from any origin
  cors: { origin: '*' }
});
console.log('*** SOCKET.IO INITIALIZED ***');
console.log('Socket.IO version:', require('socket.io/package.json').version);
// Make io globally accessible so monitorService can emit events to all connected clients
global.io = io;

// Set the port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// ====================
// MIDDLEWARE SETUP
// ====================

// Parse JSON request bodies (for API requests)
app.use(express.json());

// Parse URL-encoded request bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the view engine for rendering templates
app.set('view engine', 'ejs');

// Set the directory for EJS templates
app.set('views', path.join(__dirname, 'views'));

// Request logging middleware (simple console logging for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ====================
// SOCKET.IO CONNECTION HANDLER
// ====================

// Listen for Socket.io client connections
io.on('connection', (socket) => {
  // Log when a client connects
  console.log(`✓ Client connected: ${socket.id}`);
  
  // Send a welcome message to the newly connected client
  socket.emit('connected', { 
    message: 'Connected to monitoring server',
    timestamp: new Date()
  });
  
  // Listen for client disconnect event
  socket.on('disconnect', () => {
    // Log when a client disconnects
    console.log(`✗ Client disconnected: ${socket.id}`);
  });
});

// ====================
// ROUTES
// ====================

// Dashboard routes (mounted at root path)
app.use('/', dashboardRoutes);

// API routes (mounted at /api path)
app.use('/api', apiRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Global error handler for any server errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Something went wrong!');
});

// ====================
// DATABASE & SERVER INITIALIZATION
// ====================

/**
 * Initialize or update the monitored websites from .env
 * Creates website entries for all URLs in MONITOR_URLS (comma-separated)
 * Removes websites that are no longer in the list
 */
async function initializeWebsite() {
  try {
    // Import Website model
    const Website = require('./models/Website');
    
    // Get the URLs from environment variable (supports both old and new format)
    let monitorUrls = [];
    
    // Check for new format (MONITOR_URLS - multiple URLs)
    if (process.env.MONITOR_URLS) {
      // Split by comma and trim whitespace
      monitorUrls = process.env.MONITOR_URLS.split(',').map(url => url.trim()).filter(url => url);
    }
    // Fallback to old format (MONITOR_URL - single URL) for backward compatibility
    else if (process.env.MONITOR_URL) {
      monitorUrls = [process.env.MONITOR_URL.trim()];
    }
    
    // If no URLs configured, log a warning and return
    if (monitorUrls.length === 0) {
      console.log('⚠️  Warning: No websites configured. Set MONITOR_URLS in .env file');
      console.log('   Example: MONITOR_URLS=https://example.com,https://example2.com');
      return;
    }
    
    console.log(`📋 Configuring ${monitorUrls.length} website(s) for monitoring...`);
    
    // Get all existing websites from database
    const existingWebsites = await Website.find();
    const existingUrls = existingWebsites.map(w => w.url);
    
    // Process each URL from the config
    for (const url of monitorUrls) {
      // Check if this URL already exists in database
      let website = await Website.findOne({ url: url });
      
      if (website) {
        // Website exists - ensure it's active
        if (!website.isActive) {
          website.isActive = true;
          await website.save();
          console.log(`✅ Reactivated monitoring: ${url}`);
        } else {
          console.log(`✅ Already monitoring: ${url}`);
        }
      } else {
        // New website - create it
        website = new Website({
          url: url,
          user: 'default_user',
          checkInterval: parseInt(process.env.CHECK_INTERVAL) || 5,
          isActive: true
        });
        await website.save();
        console.log(`➕ Added new website: ${url}`);
      }
    }
    
    // Deactivate websites that are no longer in the config
    for (const existingUrl of existingUrls) {
      if (!monitorUrls.includes(existingUrl)) {
        const website = await Website.findOne({ url: existingUrl });
        if (website && website.isActive) {
          website.isActive = false;
          await website.save();
          console.log(`⏸️  Deactivated website (no longer in config): ${existingUrl}`);
        }
      }
    }
    
    console.log(`✅ Website configuration complete`);
    
  } catch (error) {
    console.error('Error initializing websites:', error.message);
  }
}

/**
 * Initialize the application
 * Connects to database, initializes website, starts monitoring service, and starts HTTP server
 */
async function initializeApp() {
  try {
    // Step 1: Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await connectDB();
    
    // Step 2: Initialize the monitored website from .env
    console.log('Initializing monitored website...');
    await initializeWebsite();
    
    // Step 3: Start the monitoring service (cron job for periodic checks)
    console.log('Starting monitoring service...');
    startMonitoring();
    
    // Step 4: Start the HTTP server (not app.listen, but server.listen for Socket.io)
    server.listen(PORT, () => {
      console.log(`\n✅ Server is running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔌 API: http://localhost:${PORT}/api`);
      console.log(`🔌 Socket.io: Connected on ws://localhost:${PORT}`);
      console.log('\nPress Ctrl+C to stop the server\n');
    });
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// ====================
// GRACEFUL SHUTDOWN
// ====================

/**
 * Handle graceful shutdown on SIGINT (Ctrl+C)
 * Closes database connection and exits cleanly
 */
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  try {
    // Close MongoDB connection
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    // Exit the process with success code
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

/**
 * Handle SIGTERM signal (for Docker/container shutdown)
 * Closes database connection and exits cleanly
 */
process.on('SIGTERM', async () => {
  console.log('\n\n🛑 SIGTERM received, shutting down...');
  
  try {
    // Close MongoDB connection
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    // Exit the process with success code
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the application initialization
initializeApp();

// Export the app for testing purposes
module.exports = app;