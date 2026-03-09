/**
 * GHOSTCHAT — Production-grade ephemeral chat server.
 *
 * Privacy guarantees:
 *   - Zero message persistence. Messages are broadcast and immediately forgotten.
 *   - Server logs never contain message content (only redacted metadata).
 *   - Rooms are destroyed when empty or after 30 min of inactivity.
 *   - All state is in-process RAM only.
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const roomManager   = require('./roomManager');
const rateLimiter   = require('./rateLimiter');
const cleanupWorker = require('./cleanupWorker');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT             = process.env.PORT || 3001;
const CLIENT_ORIGIN    = process.env.CLIENT_ORIGIN || 'https://ghoostchat-1.onrender.com';
const NODE_ENV         = process.env.NODE_ENV || 'development';
const IS_PROD          = NODE_ENV === 'production';
const MAX_MSG_LENGTH   = 500;

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],  // Vite in dev needs this
        styleSrc:    ["'self'", "'unsafe-inline'"],
        connectSrc:  ["'self'", 'ws:', 'wss:'],
        imgSrc:      ["'self'", 'data:'],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// CORS — only allow configured origin
const corsOptions = {
  origin:      CLIENT_ORIGIN,
  credentials: true,
  methods:     ['GET', 'POST'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// HTTP rate limiter — prevents API-level abuse
const apiLimiter = rateLimit({
  windowMs:          15 * 60 * 1000, // 15 minutes
  max:               100,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', apiLimiter);

// ─── Health / stats endpoints ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomCount() });
});

// In production, serve the built React app
if (IS_PROD) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ─── HTTP + Socket.IO server ──────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors:              corsOptions,
  pingTimeout:       60_000,
  pingInterval:      25_000,
  maxHttpBufferSize: 1e4,  // 10 KB max payload
  transports:        ['websocket', 'polling'],
});

// ─── Sanitization helpers ─────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#96;');
}

function sanitizeMessage(raw) {
  return escapeHtml(String(raw)).trim().substring(0, MAX_MSG_LENGTH);
}

// ─── Socket.IO connection handler ─────────────────────────────────────────────
io.on('connection', (socket) => {
  // Determine requesting IP (supports proxies with X-Forwarded-For)
  const ip =
    socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
    socket.handshake.address;

  // Per-IP connection throttle
  if (!rateLimiter.trackConnection(ip)) {
    console.warn(`[Security] IP ${ip} exceeded connection limit. Rejecting socket ${socket.id}.`);
    socket.emit('error_event', { code: 'CONN_LIMIT', message: 'Too many connections from your network.' });
    socket.disconnect(true);
    return;
  }

  // Track which room this socket is in (one room per socket)
  let currentRoom  = null;
  let currentName  = null;

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomCode, name, createOnly = false } = {}) => {
    try {
      // Input validation
      if (!roomCode || typeof roomCode !== 'string') {
        return socket.emit('join_error', { message: 'Room code is required.' });
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        return socket.emit('join_error', { message: 'Name is required.' });
      }

      const normalizedCode = roomCode.toUpperCase().trim();

      if (!roomManager.isValidRoomCode(normalizedCode)) {
        return socket.emit('join_error', {
          message: 'Room code must be 4–12 uppercase letters/numbers.',
        });
      }

      // Join-rate limiter
      if (!rateLimiter.checkJoinRate(socket.id)) {
        return socket.emit('join_error', {
          message: 'Too many join attempts. Wait a moment.',
        });
      }

      // If user intends to create a brand-new room, reject if code is already taken
      if (createOnly === true && roomManager.roomExists(normalizedCode)) {
        return socket.emit('join_error', {
          message: 'Room code already in use. Please generate a new one.',
        });
      }

      // Leave existing room if already in one
      if (currentRoom) {
        leaveCurrentRoom(socket);
      }

      const wasNew = !roomManager.roomExists(normalizedCode);

      // Get-or-create the room
      const code = roomManager.getOrCreateRoom(normalizedCode);
      roomManager.addUserToRoom(code, socket.id, name);

      socket.join(code);
      currentRoom = code;
      currentName = roomManager.getUserInRoom(code, socket.id)?.name || escapeHtml(name.trim().substring(0, 30));

      const users = roomManager.getRoomUsers(code);

      // Confirm join to the joining socket
      socket.emit('room_joined', {
        roomCode:  code,
        name:      currentName,
        isNew:     wasNew,
        isHost:    roomManager.isHost(code, socket.id),
        userCount: users.length,
        users:     users.map(u => ({ name: u.name, isYou: u.socketId === socket.id })),
      });

      // Notify everyone else in the room
      socket.to(code).emit('user_joined', {
        name:      currentName,
        userCount: users.length,
        users:     users.map(u => ({ name: u.name })),
      });

      // NOTE: we do NOT log the room code or name in production
      if (!IS_PROD) {
        console.log(`[Room] ${socket.id} joined room ${code} as "${currentName}" (${users.length} users)`);
      }
    } catch (err) {
      socket.emit('join_error', { message: err.message || 'Could not join room.' });
    }
  });

  // ── send_message ──────────────────────────────────────────────────────────
  socket.on('send_message', ({ content, encrypted = false, iv, salt } = {}) => {
    if (!currentRoom || !currentName) {
      return socket.emit('error_event', { message: 'Not in a room.' });
    }

    // Rate-limit messages
    if (!rateLimiter.checkMessageRate(socket.id)) {
      const budget = rateLimiter.getMessageBudget(socket.id);
      return socket.emit('rate_limited', {
        message:   `Slow down! Max ${rateLimiter.MESSAGE_LIMIT} messages per ${rateLimiter.MESSAGE_WINDOW_MS / 1000}s.`,
        resetInMs: budget.resetInMs,
      });
    }

    // ── E2E encrypted path ────────────────────────────────────────────────
    if (encrypted) {
      // Server cannot read the payload — relay as-is.
      // We only validate that the ciphertext exists and isn't huge.
      if (typeof content !== 'string' || content.length > 4096) {
        return socket.emit('error_event', { message: 'Invalid encrypted payload.' });
      }

      roomManager.updateRoomActivity(currentRoom);

      const packet = {
        id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender:    currentName,
        content,          // opaque ciphertext — server never decrypts it
        iv,               // AES-GCM IV, needed by recipients
        salt,             // PBKDF2 salt, needed by recipients
        encrypted: true,
        timestamp: Date.now(),
      };

      // Broadcast to whole room (including sender for UI confirmation)
      io.to(currentRoom).emit('new_message', packet);
      // PRIVACY: we intentionally do NOT log `content`
      return;
    }

    // ── Plaintext path ────────────────────────────────────────────────────
    if (!content || typeof content !== 'string') {
      return socket.emit('error_event', { message: 'Message content required.' });
    }

    const safe = sanitizeMessage(content);
    if (!safe) return;

    roomManager.updateRoomActivity(currentRoom);

    const packet = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender:    currentName,
      content:   safe,
      encrypted: false,
      timestamp: Date.now(),
    };

    io.to(currentRoom).emit('new_message', packet);
    // PRIVACY: message body is intentionally never logged
  });

  // ── typing indicators ─────────────────────────────────────────────────────
  socket.on('typing_start', () => {
    if (currentRoom && currentName) {
      socket.to(currentRoom).emit('user_typing', { name: currentName });
    }
  });

  socket.on('typing_stop', () => {
    if (currentRoom && currentName) {
      socket.to(currentRoom).emit('user_stopped_typing', { name: currentName });
    }
  });

  // ── clear_chat (host only) ─────────────────────────────────────────────────
  socket.on('clear_chat', () => {
    if (!currentRoom) return;
    if (!roomManager.isHost(currentRoom, socket.id)) return;
    io.to(currentRoom).emit('chat_cleared', { clearedBy: currentName });
  });

  // ── leave_room ────────────────────────────────────────────────────────────
  socket.on('leave_room', () => {
    leaveCurrentRoom(socket);
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    leaveCurrentRoom(socket);
    rateLimiter.releaseConnection(ip);
    rateLimiter.cleanupSocket(socket.id);
  });

  // ── helpers ───────────────────────────────────────────────────────────────
  function leaveCurrentRoom(sock) {
    if (!currentRoom) return;

    const leavingRoom = currentRoom;
    const hostLeaving = roomManager.isHost(leavingRoom, sock.id);

    const { destroyed, user } = roomManager.removeUserFromRoom(leavingRoom, sock.id);
    const name = user?.name || currentName || 'Someone';

    // Remove from Socket.IO room (no-op if already removed by disconnect)
    sock.leave(leavingRoom);

    if (hostLeaving && !destroyed) {
      // Capture remaining users before deleting the room record
      const remainingUsers = roomManager.getRoomUsers(leavingRoom);
      roomManager.deleteRoom(leavingRoom);

      // Send room_closed directly to each remaining connected socket
      // (bypasses Socket.IO adapter room lookup which may lag after disconnect)
      remainingUsers.forEach(({ socketId }) => {
        const target = io.sockets.sockets.get(socketId);
        if (target) {
          target.emit('room_closed', {
            reason: `Host ${name} left. Room has been closed.`,
          });
        }
      });
    } else if (!destroyed) {
      const users = roomManager.getRoomUsers(leavingRoom);
      io.to(leavingRoom).emit('user_left', {
        name,
        userCount: users.length,
        users:     users.map(u => ({ name: u.name })),
      });
    }

    currentRoom = null;
    currentName = null;
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🔒 GHOSTCHAT server running on port ${PORT}`);
  console.log(`   Environment : ${NODE_ENV}`);
  console.log(`   Client origin: ${CLIENT_ORIGIN}`);
  console.log(`   Privacy mode : messages are never persisted or logged\n`);

  cleanupWorker.startCleanupWorker(io);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully.`);
  cleanupWorker.stopCleanupWorker();

  io.emit('server_shutdown', { message: 'Server is restarting. All rooms will be cleared.' });

  httpServer.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });

  // Force-kill after 5 s if connections linger
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = { app, httpServer, io };
