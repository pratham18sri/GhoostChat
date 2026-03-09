/**
 * RoomManager — In-memory ephemeral room store.
 *
 * PRIVACY CONTRACT:
 *   - No data is written to disk, database, or any persistent store.
 *   - All room/user data lives exclusively in process RAM.
 *   - When the process exits, all data is irretrievably gone.
 *   - Message contents are NEVER stored here (broadcast-only).
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const ROOM_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_USERS_PER_ROOM = 50;
const MAX_ROOMS = 2000;
const MAX_NAME_LENGTH = 30;
const VALID_ROOM_CODE_RE = /^[A-Z0-9]{4,12}$/;

// ─── In-memory store ──────────────────────────────────────────────────────────
/**
 * rooms: Map<roomCode, RoomRecord>
 *
 * RoomRecord = {
 *   users: Map<socketId, { name: string, joinedAt: number }>,
 *   hostSocketId: string|null,
 *   createdAt: number,
 *   lastActivity: number
 * }
 */
const rooms = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeName(raw) {
  return String(raw)
    .trim()
    .replace(/[<>&"'`]/g, '')   // strip HTML-sensitive chars
    .substring(0, MAX_NAME_LENGTH)
    || 'Anonymous';
}

function normalizeCode(code) {
  return String(code).toUpperCase().trim();
}

function isValidRoomCode(code) {
  return VALID_ROOM_CODE_RE.test(normalizeCode(code));
}

// ─── Room CRUD ────────────────────────────────────────────────────────────────
function roomExists(roomCode) {
  return rooms.has(normalizeCode(roomCode));
}

function createRoom(roomCode) {
  const code = normalizeCode(roomCode);

  if (rooms.size >= MAX_ROOMS) {
    throw new Error('Server at capacity. Try again later.');
  }

  rooms.set(code, {
    users: new Map(),
    hostSocketId: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  });

  return code;
}

function getOrCreateRoom(roomCode) {
  const code = normalizeCode(roomCode);
  if (!rooms.has(code)) createRoom(code);
  return code;
}

// ─── User management ─────────────────────────────────────────────────────────
function addUserToRoom(roomCode, socketId, name) {
  const code = normalizeCode(roomCode);
  const room = rooms.get(code);
  if (!room) return false;

  if (room.users.size >= MAX_USERS_PER_ROOM) {
    throw new Error('Room is full (max 50 users).');
  }

  room.users.set(socketId, {
    name: sanitizeName(name),
    joinedAt: Date.now(),
  });

  // First user to join becomes the host
  if (room.hostSocketId === null) {
    room.hostSocketId = socketId;
  }

  room.lastActivity = Date.now();
  return true;
}

/**
 * @returns {{ destroyed: boolean, user: object|null }}
 */
function removeUserFromRoom(roomCode, socketId) {
  const code = normalizeCode(roomCode);
  const room = rooms.get(code);
  if (!room) return { destroyed: false, user: null };

  const user = room.users.get(socketId) || null;
  room.users.delete(socketId);

  // Auto-destroy when the last user leaves
  if (room.users.size === 0) {
    rooms.delete(code);
    return { destroyed: true, user };
  }

  room.lastActivity = Date.now();
  return { destroyed: false, user };
}

function getRoomUsers(roomCode) {
  const room = rooms.get(normalizeCode(roomCode));
  if (!room) return [];

  return Array.from(room.users.entries()).map(([socketId, data]) => ({
    socketId,
    name: data.name,
    joinedAt: data.joinedAt,
  }));
}

function getUserInRoom(roomCode, socketId) {
  const room = rooms.get(normalizeCode(roomCode));
  if (!room) return null;
  return room.users.get(socketId) || null;
}

function updateRoomActivity(roomCode) {
  const room = rooms.get(normalizeCode(roomCode));
  if (room) room.lastActivity = Date.now();
}

function getRoomInfo(roomCode) {
  const room = rooms.get(normalizeCode(roomCode));
  if (!room) return null;
  return {
    userCount: room.users.size,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
  };
}

function isHost(roomCode, socketId) {
  const room = rooms.get(normalizeCode(roomCode));
  if (!room) return false;
  return room.hostSocketId === socketId;
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────
function getInactiveRooms(thresholdMs = ROOM_INACTIVITY_TIMEOUT_MS) {
  const now = Date.now();
  const inactive = [];
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > thresholdMs) inactive.push(code);
  }
  return inactive;
}

function deleteRoom(roomCode) {
  return rooms.delete(normalizeCode(roomCode));
}

function getRoomCount() {
  return rooms.size;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  isValidRoomCode,
  roomExists,
  getOrCreateRoom,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  getUserInRoom,
  isHost,
  updateRoomActivity,
  getRoomInfo,
  getInactiveRooms,
  deleteRoom,
  getRoomCount,
  ROOM_INACTIVITY_TIMEOUT_MS,
};
