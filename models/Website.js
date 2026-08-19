// Website Model
// Stores information about the monitored website

const mongoose = require('mongoose');

/**
 * Website Schema
 * Defines the structure for websites being monitored
 */
const websiteSchema = new mongoose.Schema({
  // URL of the website to monitor (required, unique)
  url: {
    type: String,
    required: [true, 'Website URL is required'],
    unique: true,
    trim: true
  },
  
  // User/owner identifier for the website
  user: {
    type: String,
    default: 'default_user',
    trim: true
  },
  
  // Check interval in minutes (default: 5 minutes)
  checkInterval: {
    type: Number,
    default: 5,
    min: [1, 'Check interval must be at least 1 minute']
  },
  
  // Current status of the website
  currentStatus: {
    type: String,
    enum: ['up', 'down', 'unknown'],
    default: 'unknown'
  },
  
  // Last time the website was checked
  lastChecked: {
    type: Date,
    default: null
  },
  
  // Whether monitoring is active for this website
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timestamp when the website was added to monitoring
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // Timestamp when the website record was last updated
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
websiteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create and export the Website model
const Website = mongoose.model('Website', websiteSchema);

module.exports = Website;
