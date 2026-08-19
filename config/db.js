// MongoDB connection configuration
// This module handles the database connection using Mongoose

const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * Uses connection string from environment variable MONGODB_URI
 * Falls back to local MongoDB instance if not specified
 */
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment or use local default
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/website-monitor';
    
    // Connect to MongoDB with Mongoose
    const conn = await mongoose.connect(mongoURI);
    
    // Log successful connection with host information
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Return connection object for potential future use
    return conn;
  } catch (error) {
    // Log detailed error information
    console.error(`Error connecting to MongoDB: ${error.message}`);
    
    // Exit process with failure code if connection fails
    process.exit(1);
  }
};

/**
 * Handle MongoDB connection events
 * Provides logging for connection state changes
 */
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error(`Mongoose connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

// Export the connection function
module.exports = connectDB;
