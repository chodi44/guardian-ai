require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const { connectDB } = require('./db');
const apiRoutes = require('./routes/api');
const { startEscalationScheduler } = require('./services/escalationService');
const { memoryIncidents } = require('./services/incidentService');

const app = express();
const PORT = process.env.PORT || 8000;

// Configurable Deployed Origins for CORS and WebSockets
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// CORS Middleware for multi-site deployment
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Policy: Origin ${origin} not permitted.`));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching for instant updates in production/development
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Create HTTP Server & Attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Broadcast real-time emergency events via Socket.IO
io.on('connection', socket => {
  console.log(`⚡ [Socket.IO] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Attach Socket.IO instance to app for router access
app.set('io', io);

// Mount Backend API
app.use('/api', apiRoutes);

// Remove the 30-screen hub tab: redirect /hub.html and /hub to home
app.get(['/hub.html', '/hub'], (req, res) => {
  res.redirect('/');
});

// Default Landing Page Routes (Serve landingpage.html)
app.get(['/', '/landing', '/landing.html', '/landingpage', '/landingpage.html', '/landing-page', '/landing-page.html', '/index', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'landingpage.html'));
});

// Portal Directory shortcuts
app.get(['/user', '/user/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'user', 'dashboard', 'index.html'));
});

app.get(['/guardian', '/guardian/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'guardian', 'dashboard', 'index.html'));
});

// Combine all screens under Single Page App (Server-side Redirects)
app.get(['/location.html', '/location'], (req, res) => {
  res.redirect('/user/dashboard/index.html#location');
});
app.get(['/journeys.html', '/journeys'], (req, res) => {
  res.redirect('/user/dashboard/index.html#journeys');
});
app.get(['/alerts.html', '/alerts'], (req, res) => {
  res.redirect('/user/dashboard/index.html#alerts');
});
app.get(['/band.html', '/band'], (req, res) => {
  res.redirect('/user/dashboard/index.html#band');
});
app.get(['/band-controls.html', '/band-controls'], (req, res) => {
  res.redirect('/user/dashboard/index.html#band-controls');
});
app.get(['/safety-history.html', '/safety-history'], (req, res) => {
  res.redirect('/user/dashboard/index.html#safety-history');
});
app.get(['/insights.html', '/insights'], (req, res) => {
  res.redirect('/user/dashboard/index.html#insights');
});
app.get(['/voice-mails.html', '/voice-mails'], (req, res) => {
  res.redirect('/guardian/dashboard/index.html#acoustic');
});
app.get(['/sos-alert.html', '/sos-alert'], (req, res) => {
  res.redirect('/user/dashboard/index.html#sos');
});
app.get(['/home.html', '/home'], (req, res) => {
  res.redirect('/guardian/dashboard/index.html#overview');
});

// User subpages mapping to User SPA tabs
app.get(['/user/guardians', '/user/guardians/', '/user/guardians/index.html'], (req, res) => {
  res.redirect('/user/dashboard/index.html#guardians');
});
app.get(['/user/guardian-requests', '/user/guardian-requests/', '/user/guardian-requests/index.html'], (req, res) => {
  res.redirect('/user/dashboard/index.html#requests');
});
app.get(['/user/guardian-id', '/user/guardian-id/', '/user/guardian-id/index.html'], (req, res) => {
  res.redirect('/user/dashboard/index.html#guardian-id');
});
app.get(['/user/permissions', '/user/permissions/', '/user/permissions/index.html'], (req, res) => {
  res.redirect('/user/dashboard/index.html#permissions');
});
app.get(['/user/profile', '/user/profile/', '/user/profile/index.html'], (req, res) => {
  res.redirect('/user/dashboard/index.html#profile');
});
app.get(['/user/settings', '/user/settings/', '/user/settings/index.html'], (req, res) => {
  res.redirect('/user/dashboard/index.html#settings');
});

// Guardian subpages mapping to Guardian SPA tabs
app.get(['/guardian/connect-user', '/guardian/connect-user/', '/guardian/connect-user/index.html'], (req, res) => {
  res.redirect('/guardian/dashboard/index.html#connect');
});
app.get(['/guardian/linked-users', '/guardian/linked-users/', '/guardian/linked-users/index.html'], (req, res) => {
  res.redirect('/guardian/dashboard/index.html#linked-users');
});
app.get(['/guardian/permissions', '/guardian/permissions/', '/guardian/permissions/index.html'], (req, res) => {
  res.redirect('/guardian/dashboard/index.html#permissions');
});
app.get(['/guardian/settings', '/guardian/settings/', '/guardian/settings/index.html'], (req, res) => {
  res.redirect('/guardian/dashboard/index.html#settings');
});

// Clean URL rewrite middleware
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();

  const reqPath = req.path;
  const filePath = path.join(__dirname, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return next();
  }

  if (fs.existsSync(filePath + '.html') && fs.statSync(filePath + '.html').isFile()) {
    return res.sendFile(filePath + '.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    const dashPath = path.join(filePath, 'dashboard', 'index.html');
    if (fs.existsSync(dashPath)) return res.sendFile(dashPath);
  }

  next();
});

// Emergency Operations Center (Police Portal) Routes & Static Assets
const emergencyPortalDir = path.join(__dirname, 'guardian_emergency_portal');

app.use('/guardian_emergency_portal', express.static(emergencyPortalDir));
app.use('/emergency', express.static(emergencyPortalDir));
app.use('/emergencyn', express.static(emergencyPortalDir));
app.use('/emergencies', express.static(emergencyPortalDir));
app.use('/police', express.static(emergencyPortalDir));
app.use('/pages', express.static(path.join(emergencyPortalDir, 'pages')));

// Fallback for Emergency Operations Center (Police Portal) SPA paths
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (p === '/emergency' || p.startsWith('/emergency/') ||
      p === '/emergencyn' || p.startsWith('/emergencyn/') ||
      p === '/emergencies' || p.startsWith('/emergencies/') ||
      p === '/police' || p.startsWith('/police/') ||
      p === '/guardian_emergency_portal' || p.startsWith('/guardian_emergency_portal/')) {
    // If request is for a static asset (CSS, JS, images), let it pass to static handler
    if (path.extname(p) && path.extname(p) !== '.html') return next();
    return res.sendFile(path.join(emergencyPortalDir, 'index.html'));
  }
  next();
});

// Serve static assets
app.use(express.static(__dirname, { extensions: ['html'] }));

// Fallback 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'landingpage.html'));
});

// Start Server & Connect Database
async function startServer() {
  await connectDB();
  startEscalationScheduler(memoryIncidents);

  server.listen(PORT, () => {
    console.log('\n============================================================');
    console.log(`🛡️  Guardian AI Node.js Shared Server running on Port ${PORT}`);
    console.log(`   • Internal Port:       ${PORT}`);
    console.log(`   • Allowed CORS:        ${allowedOrigins.join(', ')}`);
    console.log(`   • Socket.IO WebSocket: Enabled on Port ${PORT}`);
    console.log('============================================================\n');
  });
}

startServer();

module.exports = { app, server };
