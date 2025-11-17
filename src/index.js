// src/index.js
// Point d'entrée principal du serveur

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { authenticateSpotify } = require('./config/spotify');
const { setupSocketHandlers } = require('./handlers/socketHandlers');
const { setupApiRoutes } = require('./handlers/apiRoutes');
const logger = require('./utils/logger');

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==================== EXPRESS APP ====================
const app = express();
const server = http.createServer(app);

// Trust proxy - Required for Render.com and other reverse proxies
// This allows express-rate-limit to correctly identify users via X-Forwarded-For
app.set('trust proxy', true);

// ==================== MIDDLEWARE ====================

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

// Rate limiting pour les API REST
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requêtes max par minute
  message: {
    error: 'Trop de requêtes, réessayez dans 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// Logging des requêtes
app.use((req, res, next) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// ==================== SOCKET.IO ====================
const io = socketIo(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Setup Socket.IO handlers
const games = setupSocketHandlers(io);

// ==================== ROUTES REST ====================
const apiRouter = setupApiRoutes(games);
app.use('/api', apiRouter);

// Route racine
app.get('/', (req, res) => {
  res.json({
    name: 'Blindtest Backend API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      playlist: '/api/spotify/playlist/:id',
      gameStatus: '/api/game/:roomCode/status',
      games: '/api/games',
      metrics: '/api/metrics'
    },
    modes: [
      'accumul_points',
      'reflexoquiz',
      'qcm',
      'questions_rafale',
      'chaud_devant',
      'tueurs_gages'
    ]
  });
});

// ==================== ERROR HANDLING ====================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ==================== STARTUP ====================

async function startServer() {
  try {
    // Authentifier Spotify
    logger.info('Authenticating with Spotify...');
    await authenticateSpotify();

    // Démarrer le serveur
    server.listen(PORT, () => {
      logger.info('🚀 Server started', {
        port: PORT,
        env: NODE_ENV,
        clientUrl: CLIENT_URL
      });

      logger.info('✅ Blindtest Backend v2.0 ready!');
      logger.info('📡 Socket.IO listening for connections');
      logger.info('🎵 Spotify API authenticated');
      logger.info(`🌍 API docs available at http://localhost:${PORT}/`);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  // Log to console first (synchronous, always works)
  console.error('❌ UNCAUGHT EXCEPTION ❌');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('Name:', error.name);

  // Also log with Winston
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });

  // Give logger time to flush before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  // Log to console first
  console.error('❌ UNHANDLED REJECTION ❌');
  console.error('Reason:', reason);
  console.error('Promise:', promise);

  // Also log with Winston
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      name: reason.name
    } : reason,
    promise
  });
});

// ==================== START ====================
startServer();

module.exports = { app, server, io };
