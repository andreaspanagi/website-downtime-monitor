# 🔍 Website Monitor

A comprehensive website monitoring application built with Node.js that tracks uptime/downtime, detects broken links, and displays real-time status on an elegant dashboard.

## 📋 Features

- **Real-time Uptime Monitoring** - Automatically checks website availability every 5 minutes
- **Email Notifications** - Instant alerts via Brevo when websites go down or come back up
- **24-Hour Status History** - Visual chart showing uptime/downtime patterns
- **Response Time Tracking** - Monitors how quickly your site responds
- **Broken Link Detection** - Crawls homepage and identifies broken links
- **Alert System** - Logs when sites go down and come back up
- **Dashboard Interface** - Beautiful, responsive EJS-powered dashboard
- **REST API** - JSON endpoints for programmatic access
- **MongoDB Storage** - Persistent data storage for historical analysis

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB + Mongoose
- **Frontend**: EJS Templates + CSS
- **Monitoring**: Axios (HTTP requests) + Node-Cron (scheduling)

## 📁 Project Structure

```
website-monitor/
├── server.js              # Express app entry point
├── config/
│   └── db.js             # MongoDB connection
├── models/
│   ├── Website.js        # Website schema
│   ├── UptimeRecord.js   # Check results schema
│   ├── Link.js           # Link status schema
│   └── Alert.js          # Alert log schema
├── services/
│   ├── monitorService.js      # Uptime check service
│   ├── linkCheckerService.js  # Link crawler service
│   └── emailService.js        # Email notification service (Brevo)
├── routes/
│   ├── dashboard.js      # Dashboard view routes
│   └── api.js            # JSON API endpoints
├── views/
│   └── dashboard.ejs     # Main dashboard template
├── public/
│   └── css/
│       ├── style.css     # Main stylesheet
│       └── dashboard.css # Dashboard styles
├── package.json          # Dependencies
├── .env.example          # Environment template
└── README.md             # This file
```

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v4.4 or higher) - [Download](https://www.mongodb.com/try/download/community)
  - Or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free cloud database)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and set your monitored website URL:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/website-monitor
CHECK_INTERVAL=5
MONITOR_URL=https://example.com    # ← Change this to your website!

# Email notifications (optional but recommended)
GMAIL_SMTP_USER=your-smtp-login@smtp-brevo.com
GMAIL_APP_KEY=your-smtp-api-key
# Single recipient:
ALERT_EMAIL=your-email@example.com
# Multiple recipients (comma-separated):
# ALERT_EMAIL=email1@example.com,email2@example.com,email3@example.com

NODE_ENV=development
```

**Important:** The website to monitor is configured via the `MONITOR_URL` environment variable in the `.env` file. Change this URL to monitor a different website and restart the server.

### Step 2.5: Setup Email Notifications (Optional)

For email alerts when your website goes down:

1. Sign up for a free [Brevo](https://www.brevo.com/) account
2. Get your SMTP credentials from Settings → SMTP & API
3. Add credentials to `.env` (see above)

**Note:** Email notifications are optional. The application will work without them, but you won't receive email alerts.

### Step 3: Start MongoDB

**Option A: Local MongoDB**
```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
# Start MongoDB service from Services panel or run mongod.exe
```

**Option B: MongoDB Atlas**
- Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Get your connection string
- Update `MONGODB_URI` in `.env` file

### Step 4: Start the Application

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📊 Usage Guide

### 1. Configure Monitoring

The website to monitor is set in your `.env` file:

```env
MONITOR_URL=https://example.com
```

To monitor a different website:
1. Edit the `.env` file
2. Update `MONITOR_URL` to your desired website
3. Restart the server
4. The new website will be automatically configured

### 2. Dashboard Overview

The dashboard displays everything on a single page:
- **Current Status** - Real-time up/down status indicator
- **24-Hour Uptime %** - Uptime percentage over last 24 hours
- **Total Checks** - Number of checks performed
- **Working Links** - Count of functional links
- **Broken Links** - Count of broken links needing attention
- **Status History Chart** - Visual timeline of uptime checks
- **Recent Uptime Checks** - Detailed check log with response times
- **Recent Alerts** - Status change notifications
- **Link Status** - All discovered links categorized by status

### 3. Manual Operations

- **Check Uptime Now** - Trigger immediate uptime check
- **Check Links Now** - Manually scan homepage for broken links

The checks will also run automatically every 5 minutes (configurable via `CHECK_INTERVAL` in `.env`).

### 4. Understanding Link Status

Links are automatically categorized:
- 🟢 **Working Links** - Status codes 200-399 (success and redirects)
- 🔴 **Broken Links** - Status codes 400-599 or connection errors  
- ⚪ **Unchecked Links** - Newly discovered, not yet verified

Click "Check Links Now" to scan the homepage and verify all links.

## 🔌 API Endpoints

All API endpoints return JSON responses.

### GET /api/status
Get current website status
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "status": "up",
    "lastChecked": "2026-08-19T10:30:00.000Z"
  }
}
```

### GET /api/uptime?hours=24
Get uptime percentage for time period
```json
{
  "success": true,
  "data": {
    "hours": 24,
    "uptimePercentage": 99.5
  }
}
```

### GET /api/records?hours=24&limit=100
Get uptime check records
```json
{
  "success": true,
  "data": {
    "count": 50,
    "records": [...]
  }
}
```

### GET /api/alerts?limit=10
Get recent alerts
```json
{
  "success": true,
  "data": {
    "count": 2,
    "alerts": [...]
  }
}
```

### GET /api/links
Get all links grouped by status
```json
{
  "success": true,
  "data": {
    "working": 10,
    "broken": 2,
    "unchecked": 5,
    "links": {...}
  }
}
```

### POST /api/alerts/acknowledge
Mark all alerts as acknowledged

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port number | `3000` | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/website-monitor` | See examples below |
| `CHECK_INTERVAL` | Minutes between checks | `5` | `5` |
| `MONITOR_URL` | Website URL to monitor | `https://example.com` | `https://google.com` |
| `GMAIL_SMTP_USER` | Brevo SMTP login (optional) | - | `user@smtp-brevo.com` |
| `GMAIL_APP_KEY` | Brevo SMTP key (optional) | - | `xsmtpsib-xxx...` |
| `ALERT_EMAIL` | Email(s) for alerts (optional) | - | `alerts@example.com` or `email1@x.com,email2@x.com` |
| `NODE_ENV` | Environment mode | `development` | `production` |

**MongoDB URI Examples:**
- Local: `mongodb://localhost:27017/website-monitor`
- Atlas: `mongodb+srv://username:password@cluster.mongodb.net/website-monitor`

### Changing Monitored Website

To monitor a different website:
1. Stop the server (Ctrl+C)
2. Edit `.env` and update `MONITOR_URL`
3. Restart the server with `npm start`
4. The new website will be automatically configured

### Monitoring Frequency

The monitoring service checks website status every `CHECK_INTERVAL` minutes (default: 5 minutes).

To change the interval:
1. Update `CHECK_INTERVAL` in `.env`
2. Restart the application

## 🧪 Testing

### Test with Real Websites

```bash
# 1. Edit .env file and set MONITOR_URL
# Example: MONITOR_URL=https://google.com

# 2. Start the server
npm start

# 3. Open browser and visit http://localhost:3000

# 4. Click "Check Uptime Now" to trigger immediate check

# 5. Click "Check Links Now" to scan for broken links

# 6. Wait for results to appear on the dashboard
```

### Test Link Checker

```bash
# 1. Make sure MONITOR_URL in .env points to a site with links
# 2. Open http://localhost:3000
# 3. Click "Check Links Now" button
# 4. Monitor console output for crawling progress
# 5. View results on dashboard (broken links shown in red section)
```

### Manual Testing via API

```bash
# Get current status
curl http://localhost:3000/api/status

# Get uptime percentage
curl http://localhost:3000/api/uptime?hours=24

# Get recent records
curl http://localhost:3000/api/records?limit=10
```

## 📝 Database Schema

### Websites Collection
- `url` - Website URL to monitor
- `user` - Owner identifier
- `checkInterval` - Check frequency in minutes
- `currentStatus` - Current status (up/down/unknown)
- `lastChecked` - Last check timestamp
- `isActive` - Whether monitoring is enabled

### UptimeRecords Collection
- `website` - Reference to Website
- `status` - Check result (up/down)
- `statusCode` - HTTP status code
- `responseTime` - Response time in milliseconds
- `errorMessage` - Error details if failed
- `timestamp` - Check timestamp

### Links Collection
- `website` - Reference to Website
- `url` - Link URL
- `status` - Link status (working/broken/unchecked)
- `statusCode` - HTTP status code
- `errorMessage` - Error details if broken
- `lastChecked` - Last check timestamp
- `discoveredAt` - When link was first found

### Alerts Collection
- `website` - Reference to Website
- `event` - Event type (down/up)
- `previousStatus` - Status before change
- `newStatus` - Status after change
- `statusCode` - HTTP status code at time of alert
- `errorMessage` - Error details
- `timestamp` - Alert timestamp
- `acknowledged` - Whether user has seen alert

## 🐛 Troubleshooting

### MongoDB Connection Errors

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solution:**
1. Ensure MongoDB is running:
   ```bash
   # Check if MongoDB is running
   ps aux | grep mongo
   
   # Start MongoDB if not running
   brew services start mongodb-community  # macOS
   sudo systemctl start mongod            # Linux
   ```

2. Verify connection string in `.env` matches your MongoDB setup

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
1. Change `PORT` in `.env` to a different number (e.g., 3001)
2. Or kill the process using port 3000:
   ```bash
   # Find process using port 3000
   lsof -i :3000
   
   # Kill the process (replace PID with actual process ID)
   kill -9 PID
   ```

### Website Not Being Checked

**Issue:** No uptime records appearing

**Solution:**
1. Check console output for errors
2. Verify website URL is valid and accessible
3. Trigger manual check with "Check Now" button
4. Check MongoDB for saved records:
   ```bash
   mongosh
   use website-monitor
   db.uptimerecords.find().pretty()
   ```

### Links Not Found

**Issue:** Link checker shows 0 links

**Solution:**
1. Verify website has actual links in HTML
2. Check that website allows crawling (not blocking bots)
3. Review console output for crawling errors

## 🔒 Security Notes

- This is a **local monitoring tool** intended for development/testing
- For production use:
  - Add authentication/authorization
  - Implement rate limiting
  - Use HTTPS
  - Secure MongoDB with authentication
  - Validate and sanitize all inputs
  - Add CORS protection

## 🚀 Future Enhancements

- [ ] Multi-website monitoring (track multiple sites simultaneously)
- [x] Email/SMS notifications for downtime alerts (Brevo integration implemented)
- [ ] SSL certificate expiration monitoring
- [ ] Performance metrics (page load time, etc.)
- [ ] Historical data visualization (7-day, 30-day charts)
- [ ] User authentication and multi-user support
- [ ] Custom check intervals per website
- [ ] Webhook support for integrations
- [ ] Export reports (PDF, CSV)
- [ ] Mobile-responsive dashboard improvements

## 📄 License

ISC

## 👤 Author

Built with ❤️ for website monitoring

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

**Need Help?**
- Check the console output for detailed error messages
- Review MongoDB logs if database issues occur
- Test with known-working websites (e.g., google.com) first
