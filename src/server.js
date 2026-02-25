// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const teacherRoutes = require('./routes/teacherRoutes');
const { startTelegramNotifications } = require('./services/telegramCron');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const groupRoutes = require('./routes/groupRoutes');
const bookingRoutes = require('./routes/bookingRoutes'); // Moved this down with other routes

// Initialize express app (THIS MUST COME BEFORE USING app)
const app = express();
const PORT = process.env.PORT || 3001;

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

// Body parser middleware (BEFORE rate limiter)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (AFTER body parser)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' // Skip rate limit for preflight
});
app.use('/api/', limiter);

app.use('/api/teachers', teacherRoutes);

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
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes (ALL routes go here, AFTER app is initialized)
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/booking-requests', bookingRoutes); // Moved here with other routes

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
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎓 University Schedule Backend API                 ║
║                                                       ║
║   Server running on port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   CORS: Enabled (all origins)                        ║
║                                                       ║
║   Health Check: http://localhost:${PORT}/health         ║
║   API Base URL: http://localhost:${PORT}/api            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

startTelegramNotifications();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;