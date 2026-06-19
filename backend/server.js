/**
 * ============================================================
 *  SERVER.JS — Main Entry Point
 *  Express + Socket.io + Clerk + MongoDB
 * ============================================================
 */

// Force IPv4 DNS — fixes SRV lookup on IPv6-only networks (e.g. Reliance/Jio)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const { clerkMiddleware } = require('@clerk/express');

const connectDB   = require('./config/db');
const routes      = require('./routes/routes');
const initSocket  = require('./services/socket');
const { generalLimiter, errorHandler } = require('./middleware/middleware');

// ─────────────────────────────────────────────
// APP + HTTP SERVER
// ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// Dynamic CORS Origin Helper
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow server-to-server or postman
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Blocked by CORS'));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Socket.io
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ─────────────────────────────────────────────
// GLOBAL MIDDLEWARE
// ─────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Clerk — MUST come before any requireAuth / getAuth
app.use(clerkMiddleware());
app.use(generalLimiter);

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
);

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use('/api', routes);

// 404
app.use((req, res) =>
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
);

// Global error handler
app.use(errorHandler);

// ─────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────
app.set('io', io);
initSocket(io);

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Run: Stop-Process -Name node -Force`);
      process.exit(1);
    } else {
      throw err;
    }
  });

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🏙️  CivicTN Platform — Backend Running     ║
║   Port  : ${PORT}                               ║
║   Mode  : ${(process.env.NODE_ENV || 'development').padEnd(11)}                 ║
║   Socket: Enabled (Socket.io)                ║
║   DB    : MongoDB Atlas                       ║
╚══════════════════════════════════════════════╝
    `);
  });
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));

module.exports = { app, server, io };
