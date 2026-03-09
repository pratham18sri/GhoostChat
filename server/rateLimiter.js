/**
 * Socket-level rate limiter for GHOOSTCHAT.
 *
 * Tracks per-socket message rates and per-IP connection counts
 * entirely in process memory — no external store required.
 */

'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
const MESSAGE_LIMIT       = 5;          // max messages per window
const MESSAGE_WINDOW_MS   = 5_000;      // 5-second rolling window
const JOIN_LIMIT          = 10;         // max join attempts per window
const JOIN_WINDOW_MS      = 60_000;     // 1-minute rolling window
const MAX_CONNS_PER_IP    = 10;         // concurrent sockets per IP

// ─── State ────────────────────────────────────────────────────────────────────
/** socketId → { count, windowStart } */
const msgTrackers  = new Map();
/** socketId → { count, windowStart } */
const joinTrackers = new Map();
/** ip → connectionCount */
const ipConns      = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function checkWindowedRate(map, id, limit, windowMs) {
  const now = Date.now();

  if (!map.has(id)) {
    map.set(id, { count: 0, windowStart: now });
  }

  const t = map.get(id);

  // Slide window
  if (now - t.windowStart >= windowMs) {
    t.count      = 0;
    t.windowStart = now;
  }

  t.count += 1;
  return t.count <= limit;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the socket is within its message rate budget.
 * Call this BEFORE broadcasting a message.
 */
function checkMessageRate(socketId) {
  return checkWindowedRate(msgTrackers, socketId, MESSAGE_LIMIT, MESSAGE_WINDOW_MS);
}

/**
 * Returns true if the socket is within its join rate budget.
 * Call this on every join_room event.
 */
function checkJoinRate(socketId) {
  return checkWindowedRate(joinTrackers, socketId, JOIN_LIMIT, JOIN_WINDOW_MS);
}

/**
 * Records a new WebSocket connection for the given IP.
 * Returns false if the IP already has too many open connections.
 */
function trackConnection(ip) {
  const count = (ipConns.get(ip) || 0) + 1;
  ipConns.set(ip, count);
  return count <= MAX_CONNS_PER_IP;
}

/**
 * Decrements the connection count for the given IP.
 * Call this on socket disconnect.
 */
function releaseConnection(ip) {
  const count = ipConns.get(ip) || 0;
  if (count <= 1) {
    ipConns.delete(ip);
  } else {
    ipConns.set(ip, count - 1);
  }
}

/**
 * Full cleanup when a socket disconnects.
 */
function cleanupSocket(socketId) {
  msgTrackers.delete(socketId);
  joinTrackers.delete(socketId);
}

/**
 * Returns remaining budget info (used for client-side feedback).
 */
function getMessageBudget(socketId) {
  const t = msgTrackers.get(socketId);
  if (!t) return { remaining: MESSAGE_LIMIT, resetInMs: 0 };

  const now     = Date.now();
  const elapsed = now - t.windowStart;

  if (elapsed >= MESSAGE_WINDOW_MS) {
    return { remaining: MESSAGE_LIMIT, resetInMs: 0 };
  }

  return {
    remaining: Math.max(0, MESSAGE_LIMIT - t.count),
    resetInMs:  MESSAGE_WINDOW_MS - elapsed,
  };
}

module.exports = {
  checkMessageRate,
  checkJoinRate,
  trackConnection,
  releaseConnection,
  cleanupSocket,
  getMessageBudget,
  MESSAGE_LIMIT,
  MESSAGE_WINDOW_MS,
};
