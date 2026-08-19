// Link Model
// Stores information about links found on the monitored website

const mongoose = require('mongoose');

/**
 * Link Schema
 * Stores URLs found on the monitored website and their status
 */
const linkSchema = new mongoose.Schema({
  // Reference to the Website this link belongs to
  website: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: [true, 'Website reference is required']
  },
  
  // The full URL of the link
  url: {
    type: String,
    required: [true, 'Link URL is required'],
    trim: true
  },
  
  // HTTP status code of the link (200, 404, 500, etc.)
  statusCode: {
    type: Number,
    default: null
  },
  
  // Status of the link (working, broken, unchecked)
  status: {
    type: String,
    enum: ['working', 'broken', 'unchecked'],
    default: 'unchecked'
  },
  
  // Error message if link check failed
  errorMessage: {
    type: String,
    default: null
  },
  
  // Timestamp when the link was last checked
  lastChecked: {
    type: Date,
    default: null
  },
  
  // Timestamp when the link was first discovered
  discoveredAt: {
    type: Date,
    default: Date.now
  },
  
  // Number of times this link has been found during crawls
  foundCount: {
    type: Number,
    default: 1,
    min: 0
  }
});

// Create compound index for efficient queries by website and status
linkSchema.index({ website: 1, status: 1 });

// Create compound index to ensure unique URLs per website
linkSchema.index({ website: 1, url: 1 }, { unique: true });

// Static method to get broken links count for a website
linkSchema.statics.getBrokenLinksCount = async function(websiteId) {
  const count = await this.countDocuments({
    website: websiteId,
    status: 'broken'
  });
  
  return count;
};

// Static method to get all links grouped by status
linkSchema.statics.getLinksByStatus = async function(websiteId) {
  const links = await this.find({ website: websiteId })
    .sort({ status: 1, url: 1 });
  
  // Group links by status
  const grouped = {
    working: [],
    broken: [],
    unchecked: []
  };
  
  links.forEach(link => {
    grouped[link.status].push(link);
  });
  
  return grouped;
};

// Create and export the Link model
const Link = mongoose.model('Link', linkSchema);

module.exports = Link;
