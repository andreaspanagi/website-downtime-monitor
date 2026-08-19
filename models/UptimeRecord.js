// UptimeRecord Model
// Stores individual check results for website monitoring

const mongoose = require('mongoose');

/**
 * UptimeRecord Schema
 * Stores the result of each uptime check performed on a website
 */
const uptimeRecordSchema = new mongoose.Schema({
  // Reference to the Website being monitored
  website: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: [true, 'Website reference is required']
  },
  
  // Status of the check (up = successful, down = failed)
  status: {
    type: String,
    enum: ['up', 'down'],
    required: [true, 'Status is required']
  },
  
  // HTTP status code returned (e.g., 200, 404, 500)
  statusCode: {
    type: Number,
    default: null
  },
  
  // Response time in milliseconds
  responseTime: {
    type: Number,
    default: null,
    min: 0
  },
  
  // Error message if the check failed
  errorMessage: {
    type: String,
    default: null
  },
  
  // Timestamp when the check was performed
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true, // Index for faster queries by date
    expires: 604800 // Auto-delete after 7 days (7 * 24 * 60 * 60 seconds)
  }
});

// Create compound index for efficient queries by website and timestamp
uptimeRecordSchema.index({ website: 1, timestamp: -1 });

// Static method to get uptime percentage for a website
uptimeRecordSchema.statics.getUptimePercentage = async function(websiteId, hours = 24) {
  // Calculate the start time (X hours ago)
  const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  // Get all records for the website within the time range
  const records = await this.find({
    website: websiteId,
    timestamp: { $gte: startTime }
  });
  
  // If no records, return null
  if (records.length === 0) {
    return null;
  }
  
  // Count the number of "up" records
  const upCount = records.filter(record => record.status === 'up').length;
  
  // Calculate percentage
  const percentage = (upCount / records.length) * 100;
  
  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
};

// Static method to get recent records for charting
uptimeRecordSchema.statics.getRecentRecords = async function(websiteId, hours = 24, limit = 100) {
  // Calculate the start time
  const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  // Get records sorted by timestamp descending, limited to prevent overload
  const records = await this.find({
    website: websiteId,
    timestamp: { $gte: startTime }
  })
  .sort({ timestamp: -1 })
  .limit(limit);
  
  return records;
};

// Create and export the UptimeRecord model
const UptimeRecord = mongoose.model('UptimeRecord', uptimeRecordSchema);

module.exports = UptimeRecord;
