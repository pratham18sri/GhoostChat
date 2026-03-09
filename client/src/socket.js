/**
 * Singleton Socket.IO client instance.
 *
 * The socket is created ONCE and reused across all components.
 * autoConnect: false — we connect manually when a user joins a room.
 */

import { io } from 'socket.io-client';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

const socket = io(SERVER_URL, {
  autoConnect:  false,
  transports:   ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay:    1_000,
  reconnectionDelayMax: 10_000,
  timeout:      20_000,
});

export default socket;
