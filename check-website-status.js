// ============================================
// Check Website Status Script
// View current status of all websites
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');
const Website = require('./models/Website');
const Alert = require('./models/Alert');

async function checkStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    
    // Get all websites
    const websites = await Website.find();
    
    console.log('='.repeat(60));
    console.log('WEBSITE STATUS REPORT');
    console.log('='.repeat(60));
    
    for (const website of websites) {
      console.log(`\n📍 ${website.url}`);
      console.log(`   Status: ${website.currentStatus}`);
      console.log(`   Active: ${website.isActive}`);
      console.log(`   Last Checked: ${website.lastChecked || 'Never'}`);
      
      // Get recent alerts
      const alerts = await Alert.find({ website: website._id })
        .sort({ timestamp: -1 })
        .limit(3);
      
      if (alerts.length > 0) {
        console.log(`\n   Recent Alerts:`);
        alerts.forEach(alert => {
          console.log(`     ${alert.timestamp.toLocaleString()} - ${alert.event.toUpperCase()}: ${alert.previousStatus} → ${alert.newStatus}`);
        });
      } else {
        console.log(`\n   No alerts yet`);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Close connection
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkStatus();
