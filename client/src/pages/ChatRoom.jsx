import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket }     from '../hooks/useSocket';
import { useEncryption } from '../hooks/useEncryption';
import MessageList       from '../components/MessageList';
import MessageInput      from '../components/MessageInput';
import TypingIndicator   from '../components/TypingIndicator';

let msgIdCounter = 0;
function mkId() { return `msg-${Date.now()}-${++msgIdCounter}`; }

function sysMsg(text) {
  return { id: mkId(), type: 'system', content: text, timestamp: Date.now() };
}

// ─── User list sidebar ────────────────────────────────────────────────────────
function UserList({ users, currentName, onClose }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-56 ghost-card z-50 shadow-2xl animate-slide-up overflow-hidden">
      <div className="px-4 py-3 border-b border-ghost-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-ghost-subtle">
          In Room ({users.length})
        </span>
        <button onClick={onClose} className="text-ghost-subtle hover:text-ghost-text transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="py-2 max-h-64 overflow-y-auto scrollbar-hide">
        {users.map((u) => (
          <li key={u.name} className="flex items-center gap-2.5 px-4 py-2">
            <span className="online-dot shrink-0" />
            <span className="text-sm text-ghost-text truncate">
              {u.name}
              {u.name === currentName && (
                <span className="ml-1 text-xs text-ghost-accent">(you)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main ChatRoom component ──────────────────────────────────────────────────
export default function ChatRoom({ roomCode, name, e2eEnabled, onLeave }) {
  const [messages,      setMessages]      = useState([]);
  const [users,         setUsers]         = useState([]);
  const [typingUsers,   setTypingUsers]   = useState([]);
  const [rateLimited,   setRateLimited]   = useState(false);
  const [resetInMs,     setResetInMs]     = useState(0);
  const [copied,        setCopied]        = useState(false);
  const [showUsers,     setShowUsers]     = useState(false);
  const [isHost,        setIsHost]        = useState(false);
  const [e2eStatus,     setE2eStatus]     = useState(e2eEnabled ? 'initialising' : 'off');
  const [connectionBanner, setConnectionBanner] = useState(null);

  const rateLimitTimer = useRef(null);
  const typingTimers   = useRef({});

  const { connected, reconnecting, on, connect, leaveRoom, sendMessage, sendTypingStart, sendTypingStop, clearChat } = useSocket();
  const { initKey, encrypt, decrypt, e2eEnabled: keyReady } = useEncryption();

  // ── Init: connect + key derivation ─────────────────────────────────────────
  useEffect(() => {
    connect();

    if (e2eEnabled) {
      initKey(roomCode).then((ok) => {
        setE2eStatus(ok ? 'active' : 'failed');
      });
    }

    return () => {
      if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connection banner ───────────────────────────────────────────────────────
  useEffect(() => {
    if (reconnecting)       setConnectionBanner('reconnecting');
    else if (!connected)    setConnectionBanner('disconnected');
    else                    setConnectionBanner(null);
  }, [connected, reconnecting]);

  // ── Socket events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      on('room_joined', ({ isNew, isHost: h, userCount, users: u }) => {
        setUsers(u);
        setIsHost(h);
        setMessages([sysMsg(
          isNew
            ? `Room created. ${userCount} ${userCount === 1 ? 'person' : 'people'} here.`
            : `Joined room. ${userCount} ${userCount === 1 ? 'person' : 'people'} here.`
        )]);
      }),

      on('user_joined', ({ name: n, users: u }) => {
        setUsers(u);
        setMessages(m => [...m, sysMsg(`${n} joined the room.`)]);
      }),

      on('user_left', ({ name: n, users: u }) => {
        setUsers(u);
        setMessages(m => [...m, sysMsg(`${n} left the room.`)]);
        // Clear their typing state
        setTypingUsers(t => t.filter(x => x !== n));
      }),

      on('new_message', async (packet) => {
        let content  = packet.content;
        let failed   = false;

        if (packet.encrypted && packet.iv && packet.salt) {
          const dec = await decrypt(packet.content, packet.iv, roomCode, packet.salt);
          if (dec.startsWith('[')) { content = dec; failed = true; }
          else content = dec;
        }

        setMessages(m => [...m, {
          id:           packet.id || mkId(),
          type:         'message',
          sender:       packet.sender,
          content,
          encrypted:    packet.encrypted,
          decryptFailed: failed,
          timestamp:    packet.timestamp,
        }]);
      }),

      on('user_typing', ({ name: n }) => {
        if (n === name) return;
        setTypingUsers(t => t.includes(n) ? t : [...t, n]);

        // Auto-clear after 4 s if no stop event received
        if (typingTimers.current[n]) clearTimeout(typingTimers.current[n]);
        typingTimers.current[n] = setTimeout(() => {
          setTypingUsers(t => t.filter(x => x !== n));
        }, 4_000);
      }),

      on('user_stopped_typing', ({ name: n }) => {
        if (typingTimers.current[n]) clearTimeout(typingTimers.current[n]);
        setTypingUsers(t => t.filter(x => x !== n));
      }),

      on('rate_limited', ({ message: msg, resetInMs: ms }) => {
        setRateLimited(true);
        setResetInMs(ms);
        if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
        rateLimitTimer.current = setTimeout(() => setRateLimited(false), ms);
        setMessages(m => [...m, sysMsg(`⚠ Rate limited: ${msg}`)]);
      }),

      on('room_closed', ({ reason }) => {
        setMessages(m => [...m, sysMsg(`Channel terminated: ${reason}`)]);
        setTimeout(onLeave, 3_000);
      }),

      on('room_destroyed', ({ reason }) => {
        setMessages(m => [...m, sysMsg(`Room destroyed: ${reason}`)]);
        setTimeout(onLeave, 3_000);
      }),

      on('server_shutdown', ({ message: msg }) => {
        setMessages(m => [...m, sysMsg(`Server: ${msg}`)]);
      }),

      on('join_error', ({ message: msg }) => {
        setMessages(m => [...m, sysMsg(`Error: ${msg}`)]);
        setTimeout(onLeave, 2_500);
      }),

      on('error_event', ({ message: msg }) => {
        setMessages(m => [...m, sysMsg(`⚠ ${msg}`)]);
      }),

      on('chat_cleared', ({ clearedBy }) => {
        setMessages([sysMsg(`Chat cleared by host ${clearedBy}.`)]);
      }),
    ];

    return () => offs.forEach(off => off());
  }, [on, name, roomCode, decrypt, onLeave]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    if (e2eEnabled && e2eStatus === 'active') {
      const payload = await encrypt(text);
      if (payload) {
        sendMessage(payload);
        return;
      }
    }
    // Fallback to plaintext
    sendMessage({ content: text, encrypted: false });
  }, [e2eEnabled, e2eStatus, encrypt, sendMessage]);

  // ── Copy room code ──────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, [roomCode]);

  // ── Leave ───────────────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    leaveRoom();
    // Delay to let the leave_room packet transmit before closing the socket
    setTimeout(onLeave, 300);
  }, [leaveRoom, onLeave]);

  // ── E2E status pill ─────────────────────────────────────────────────────────
  const E2EPill = () => {
    if (!e2eEnabled) return null;
    const cfg = {
      initialising: { color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-700/40', label: 'Deriving key…' },
      active:        { color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-700/40', label: 'E2E Active' },
      failed:        { color: 'text-red-400',     bg: 'bg-red-950/30  border-red-700/40',     label: 'E2E Failed'  },
    };
    const c = cfg[e2eStatus] || cfg.failed;
    return (
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${c.bg} ${c.color}`}>
        🔒 {c.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-ghost-bg">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-ghost-border bg-ghost-surface/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Brand + room code */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-xl leading-none select-none">👻</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm gradient-text">GHOSTCHAT</span>
                <E2EPill />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  onClick={handleCopy}
                  className="room-code-badge text-xs"
                  title="Click to copy"
                >
                  {roomCode}
                </button>
                {copied && (
                  <span className="text-[10px] text-ghost-success animate-fade-in">Copied!</span>
                )}
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* User count */}
            <button
              onClick={() => setShowUsers(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ghost-border
                         bg-ghost-surface text-ghost-subtle hover:border-ghost-accent hover:text-ghost-text
                         transition-all duration-200 text-xs font-medium"
            >
              <span className="online-dot" />
              <span>{users.length}</span>
            </button>

            {/* User list dropdown */}
            {showUsers && (
              <UserList
                users={users}
                currentName={name}
                onClose={() => setShowUsers(false)}
              />
            )}

            {/* Clear Chat — host only */}
            {isHost && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ghost-border
                           bg-ghost-surface text-ghost-subtle hover:border-amber-600 hover:text-amber-400
                           transition-all duration-200 text-xs font-medium"
                title="Clear chat for everyone"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            )}

            {/* Leave */}
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ghost-border
                         bg-ghost-surface text-ghost-subtle hover:border-red-700 hover:text-red-400
                         transition-all duration-200 text-xs font-medium"
              title="Leave room"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Leave
            </button>
          </div>
        </div>
      </header>

      {/* ── Connection banner ───────────────────────────────────────────────── */}
      {connectionBanner && (
        <div className={`shrink-0 flex items-center justify-center gap-2 py-2 text-xs font-medium animate-fade-in
          ${connectionBanner === 'reconnecting'
            ? 'bg-amber-950/60 text-amber-300 border-b border-amber-800/40'
            : 'bg-red-950/60  text-red-300   border-b border-red-800/40'}`}
        >
          {connectionBanner === 'reconnecting' ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Reconnecting…
            </>
          ) : (
            '● Disconnected from server'
          )}
        </div>
      )}

      {/* ── Message area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl w-full mx-auto">
        <MessageList messages={messages} currentName={name} />
        <TypingIndicator typingUsers={typingUsers} />
        <MessageInput
          onSend={handleSend}
          onTypingStart={sendTypingStart}
          onTypingStop={sendTypingStop}
          disabled={!connected}
          rateLimited={rateLimited}
          resetInMs={resetInMs}
        />
      </div>
    </div>
  );
}
