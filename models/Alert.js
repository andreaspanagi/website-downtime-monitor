// Alert Model
// Stores alerts for when websites go down or come back up

const mongoose = require('mongoose');

/**
 * Alert Schema
 * Stores alert events when website status changes (down/up transitions)
 */
const alertSchema = new mongoose.Schema({
  // Reference to the Website that triggered the alert
  website: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: [true, 'Website reference is required']
  },
  
  // Type of alert event (down = site went down, up = site came back up)
  event: {
    type: String,
    enum: ['down', 'up'],
    required: [true, 'Event type is required']
  },
  
  // Previous status before the change
  previousStatus: {
    type: String,
    enum: ['up', 'down', 'unknown'],
    required: [true, 'Previous status is required']
  },
  
  // New status after the change
  newStatus: {
    type: String,
    enum: ['up', 'down'],
    required: [true, 'New status is required']
  },
  
  // HTTP status code at the time of the alert (if available)
  statusCode: {
    type: Number,
    default: null
  },
  
  // Error message if the site went down
  errorMessage: {
    type: String,
    default: null
  },
  
  // Timestamp when the alert was created
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true // Index for faster queries by date
  },
  
  // Whether the alert has been acknowledged/read by user
  acknowledged: {
    type: Boolean,
    default: false
  }
});

// Create compound index for efficient queries by website and timestamp
alertSchema.index({ website: 1, timestamp: -1 });

// Static method to get recent alerts for a website
alertSchema.statics.getRecentAlerts = async function(websiteId, limit = 10) {
  const alerts = await this.find({ website: websiteId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('website', 'url'); // Include website URL in results
  
  return alerts;
};

// Static method to get unacknowledged alerts count
alertSchema.statics.getUnacknowledgedCount = async function(websiteId) {
  const count = await this.countDocuments({
    website: websiteId,
    acknowledged: false
  });
  
  return count;
};

// Static method to mark alerts as acknowledged
alertSchema.statics.acknowledgeAlerts = async function(websiteId) {
  const result = await this.updateMany(
    { website: websiteId, acknowledged: false },
    { $set: { acknowledged: true } }
  );
  
  return result.modifiedCount;
};

// Instance method to get a human-readable alert message
alertSchema.methods.getMessage = function() {
  const websiteUrl = this.website?.url || 'Website';
  
  if (this.event === 'down') {
    return `${websiteUrl} is DOWN${this.errorMessage ? ': ' + this.errorMessage : ''}`;
  } else {
    return `${websiteUrl} is back UP`;
  }
};

// Create and export the Alert model
const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
