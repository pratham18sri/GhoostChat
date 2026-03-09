/**
 * CleanupWorker — scans for and destroys inactive rooms.
 *
 * Runs on a 60-second interval. When a room has been idle for
 * ROOM_INACTIVITY_TIMEOUT_MS (30 min), all connected sockets are
 * notified and evicted, then the room record is deleted from RAM.
 */

'use strict';

const roomManager = require('./roomManager');

const CLEANUP_INTERVAL_MS = 60_000; // scan every 60 seconds

let _interval = null;
let _io       = null;

function startCleanupWorker(ioInstance) {
  _io = ioInstance;

  _interval = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  // Let Node exit naturally even if the interval is still active
  if (_interval.unref) _interval.unref();

  console.log('[Cleanup] Worker started — scanning every 60 s for inactive rooms.');
}

function stopCleanupWorker() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    console.log('[Cleanup] Worker stopped.');
  }
}

async function runCleanup() {
  const inactive = roomManager.getInactiveRooms();

  if (inactive.length === 0) return;

  console.log(`[Cleanup] Expiring ${inactive.length} inactive room(s).`);

  for (const roomCode of inactive) {
    try {
      if (_io) {
        // Tell every client in the room it has been destroyed
        _io.to(roomCode).emit('room_destroyed', {
          reason: 'Room expired after 30 minutes of inactivity.',
        });

        // Force all sockets to leave the Socket.IO room channel
        const sids = _io.sockets.adapter.rooms.get(roomCode);
        if (sids) {
          for (const sid of [...sids]) {
            const sock = _io.sockets.sockets.get(sid);
            if (sock) sock.leave(roomCode);
          }
        }
      }

      roomManager.deleteRoom(roomCode);
      console.log(`[Cleanup] Room ${roomCode} destroyed (inactivity).`);
    } catch (err) {
      console.error(`[Cleanup] Error destroying room ${roomCode}:`, err.message);
    }
  }
}

module.exports = { startCleanupWorker, stopCleanupWorker, runCleanup };
