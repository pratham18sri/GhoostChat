/**
 * useSocket — manages Socket.IO connection lifecycle and
 * exposes typed helpers for all GHOSTCHAT events.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import socket from '../socket';

export function useSocket() {
  const [connected,    setConnected]    = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const listenersRef = useRef([]);

  // ── Connection state ────────────────────────────────────────────────────────
  useEffect(() => {
    const onConnect    = ()    => { setConnected(true);  setReconnecting(false); };
    const onDisconnect = ()    => { setConnected(false); };
    const onReconnect  = ()    => { setReconnecting(true); };
    const onError      = (err) => { console.error('[Socket] Error:', err.message); };

    socket.on('connect',             onConnect);
    socket.on('disconnect',          onDisconnect);
    socket.on('reconnect_attempt',   onReconnect);
    socket.on('reconnect',           onConnect);
    socket.on('connect_error',       onError);

    return () => {
      socket.off('connect',           onConnect);
      socket.off('disconnect',        onDisconnect);
      socket.off('reconnect_attempt', onReconnect);
      socket.off('reconnect',         onConnect);
      socket.off('connect_error',     onError);
    };
  }, []);

  // ── Generic listener registration ──────────────────────────────────────────
  const on = useCallback((event, handler) => {
    socket.on(event, handler);
    listenersRef.current.push({ event, handler });
    return () => socket.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socket.off(event, handler);
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!socket.connected) socket.connect();
  }, []);

  const disconnect = useCallback(() => {
    socket.disconnect();
  }, []);

  const joinRoom = useCallback((roomCode, name, createOnly = false) => {
    socket.emit('join_room', { roomCode, name, createOnly });
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('leave_room');
  }, []);

  const sendMessage = useCallback((payload) => {
    socket.emit('send_message', payload);
  }, []);

  const sendTypingStart = useCallback(() => {
    socket.emit('typing_start');
  }, []);

  const sendTypingStop = useCallback(() => {
    socket.emit('typing_stop');
  }, []);

  const clearChat = useCallback(() => {
    socket.emit('clear_chat');
  }, []);

  return {
    socket,
    connected,
    reconnecting,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    clearChat,
    on,
    off,
  };
}
