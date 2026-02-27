const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const groupRoutes = require('./routes/groupChannelRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const groupChannelRoutes = require('./routes/groupChannelRoutes');
const broadcastRoutes    = require('./routes/broadcastRoutes');

// Import Telegram service
let startTelegramNotifications = null;
try {
  const telegram = require('./services/telegramCron');
  startTelegramNotifications = telegram.startTelegramNotifications;
  console.log('📦 Telegram module loaded successfully');
} catch (error) {
  console.error('⚠️ Could not load Telegram modules:', error.message);
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - important for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle OPTIONS requests explicitly
app.options('*', cors());

// Body parser middleware - increase limit for bulk imports
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/group-channels', groupChannelRoutes);
app.use('/api/broadcast',      broadcastRoutes);

// ── Rate limiters ──────────────────────────────────────────────────────────────

// Bulk import: generous limit — it's one big request, not many small ones
const bulkImportLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 20,                    // 20 bulk imports per minute is plenty
  message: 'Too many bulk import requests, please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});

// General API limiter — raised to accommodate normal usage
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 2000, // raised from 100 → 2000
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip;
  }
});

// Apply bulk limiter BEFORE general limiter so it takes precedence on that route
app.use('/api/schedules/bulk', bulkImportLimiter);
app.use('/api/', limiter);

// ──────────────────────────────────────────────────────────────────────────────

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    telegram: !!process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not configured'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/booking-requests', bookingRoutes);
app.use('/api/teachers', teacherRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎓 University Schedule Backend API                 ║
║                                                       ║
║   Server running on port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   CORS: Enabled (all origins)                        ║
║   Rate limit: 2000 req / 15 min (general)            ║
║   Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}                ║
║                                                       ║
║   Health Check: http://localhost:${PORT}/health         ║
║   API Base URL: http://localhost:${PORT}/api            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

  // Start Telegram notifications
  if (startTelegramNotifications) {
    console.log('🔄 Initializing Telegram service...');
    setTimeout(() => {
      try {
        startTelegramNotifications();
      } catch (error) {
        console.error('❌ Failed to start Telegram service:', error);
      }
    }, 1000);
  } else {
    console.log('⚠️ Telegram service not available');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;