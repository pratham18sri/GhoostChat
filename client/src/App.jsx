import { useState, useCallback, useEffect } from 'react';
import { useSocket }  from './hooks/useSocket';
import JoinRoom  from './pages/JoinRoom';
import ChatRoom  from './pages/ChatRoom';

/**
 * App — single-view state machine.
 *
 * Views:
 *   'join'  → JoinRoom page
 *   'chat'  → ChatRoom page
 */
export default function App() {
  const [view,     setView]     = useState('join');
  const [session,  setSession]  = useState(null);   // { name, roomCode, e2e }
  const [joinErr,  setJoinErr]  = useState('');

  const { connect, joinRoom, on, disconnect } = useSocket();

  // ── Listen for server join_error so JoinRoom can display it ────────────────
  useEffect(() => {
    const offJoinErr = on('join_error', ({ message }) => {
      setJoinErr(message);
      setView('join');
    });
    const offRoomDestroyed = on('room_destroyed', () => {
      // Handled inside ChatRoom; we just need a fallback here
    });
    return () => {
      offJoinErr();
      offRoomDestroyed();
    };
  }, [on]);

  // ── Handle join attempt from JoinRoom form ──────────────────────────────────
  const handleJoin = useCallback(({ name, roomCode, e2e }) => {
    setJoinErr('');
    setSession({ name, roomCode, e2e });

    // Connect socket (no-op if already connected)
    connect();

    // Emit join_room — server responds with room_joined or join_error
    joinRoom(roomCode, name);

    // Optimistically enter chat; join_error will bounce us back
    setView('chat');
  }, [connect, joinRoom]);

  // ── Leave room ──────────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    disconnect();
    setSession(null);
    setView('join');
  }, [disconnect]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (view === 'chat' && session) {
    return (
      <ChatRoom
        roomCode={session.roomCode}
        name={session.name}
        e2eEnabled={session.e2e}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <JoinRoom
      onJoin={handleJoin}
      externalError={joinErr}
    />
  );
}
