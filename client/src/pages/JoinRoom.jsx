import { useState, useCallback, useEffect } from 'react';

// ─── Random room code generator ───────────────────────────────────────────────
const ADJECTIVES = ['DARK', 'VOID', 'NEON', 'ECHO', 'ZERO', 'FADE', 'MIST', 'DUST', 'HAZE', 'GLOW'];
const NOUNS      = ['WOLF', 'CROW', 'MOON', 'STAR', 'FIRE', 'REEF', 'VALE', 'COVE', 'PEAK', 'DUSK'];

function generateCode() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

// ─── Ghost SVG ────────────────────────────────────────────────────────────────
function GhostIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M32 4C18.8 4 8 14.8 8 28v28l8-6 8 6 8-6 8 6 8-6 8 6V28C56 14.8 45.2 4 32 4z"
        fill="url(#ghostGrad)"
      />
      <circle cx="22" cy="26" r="5"  fill="#e2e0ff" />
      <circle cx="42" cy="26" r="5"  fill="#e2e0ff" />
      <circle cx="24" cy="27" r="2"  fill="#07070f" />
      <circle cx="44" cy="27" r="2"  fill="#07070f" />
      <defs>
        <linearGradient id="ghostGrad" x1="8" y1="4" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Shield / feature badges ──────────────────────────────────────────────────
function Badge({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ghost-border bg-ghost-surface text-ghost-subtle text-xs font-medium">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function JoinRoom({ onJoin, externalError }) {
  const [name,        setName]        = useState('');
  const [roomCode,    setRoomCode]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [e2e,         setE2e]         = useState(true);
  const [copied,      setCopied]      = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  // Show server-side join errors (e.g. code already in use) and reset loading
  useEffect(() => {
    if (externalError) {
      setError(externalError);
      setLoading(false);
    }
  }, [externalError]);

  const handleGenerate = useCallback(() => {
    setRoomCode(generateCode());
    setError('');
    setIsGenerated(true);
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setError('');

      const trimName = name.trim();
      const trimCode = roomCode.trim().toUpperCase();

      if (!trimName) {
        setError('Please enter your name.');
        return;
      }
      if (trimName.length < 1 || trimName.length > 30) {
        setError('Name must be 1–30 characters.');
        return;
      }
      if (!trimCode) {
        setError('Please enter or generate a room code.');
        return;
      }
      if (!/^[A-Z0-9]{4,12}$/.test(trimCode)) {
        setError('Room code must be 4–12 letters or numbers.');
        return;
      }

      setLoading(true);
      onJoin({ name: trimName, roomCode: trimCode, e2e, createOnly: isGenerated });
    },
    [name, roomCode, e2e, isGenerated, onJoin],
  );

  const handleRoomCodeInput = (v) => {
    setRoomCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 12));
    setError('');
    setIsGenerated(false);
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Reset loading if parent signals a failed join
  useEffect(() => {
    if (error) setLoading(false);
  }, [error]);

  return (
    <div className="grid-bg radial-glow min-h-screen flex flex-col items-center justify-center p-4">
      {/* Ambient blobs */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-900/10 blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-indigo-900/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="ghost-float">
              <GhostIcon size={72} />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-1">
            <span className="gradient-text">GHOOST</span>
            <span className="text-ghost-subtle font-light">CHAT</span>
          </h1>
          <p className="text-ghost-subtle text-sm mt-2">
            Ephemeral rooms. No accounts. No traces.
          </p>
        </div>

        {/* Card */}
        <div className="ghost-card p-6 animate-pulse-glow">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ghost-subtle mb-2">
                Your Name
              </label>
              <input
                className="ghost-input"
                type="text"
                placeholder="e.g. Phantom"
                maxLength={30}
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Room Code */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ghost-subtle mb-2">
                Room Code
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className="ghost-input pr-10 font-mono tracking-widest text-ghost-glow uppercase"
                    type="text"
                    placeholder="DARKWOLF"
                    maxLength={12}
                    value={roomCode}
                    onChange={e => handleRoomCodeInput(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {roomCode && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ghost-subtle hover:text-ghost-glow transition-colors"
                      title="Copy code"
                    >
                      {copied ? (
                        <svg className="w-4 h-4 text-ghost-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-4 py-3 rounded-xl border border-ghost-border bg-ghost-surface text-ghost-subtle
                             hover:border-ghost-accent hover:text-ghost-text transition-all duration-200
                             text-sm font-medium whitespace-nowrap"
                  title="Generate random code"
                >
                  ✦ Random
                </button>
              </div>
              <p className="text-xs text-ghost-subtle mt-1.5 ml-1">
                Share this code with anyone you want to invite.
              </p>
            </div>

            {/* E2E toggle */}
            <div className="flex items-center justify-between rounded-xl border border-ghost-border bg-ghost-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ghost-text">End-to-end encryption</p>
                <p className="text-xs text-ghost-subtle mt-0.5">Server cannot read your messages</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={e2e}
                onClick={() => setE2e(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ghost-glow focus:ring-offset-2 focus:ring-offset-ghost-bg
                  ${e2e ? 'bg-ghost-accent' : 'bg-ghost-muted'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
                    ${e2e ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-950/40 border border-red-800/50 px-3 py-2.5 animate-fade-in">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Entering room…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Enter Room
                </>
              )}
            </button>
          </form>
        </div>

        {/* Privacy badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          <Badge icon="🚫" label="No accounts" />
          <Badge icon="🧠" label="RAM-only" />
          <Badge icon="💨" label="Auto-delete" />
          <Badge icon="🔒" label="E2E encrypted" />
        </div>

        <p className="text-center text-xs text-ghost-muted mt-4">
          Rooms vanish when everyone leaves or after 30 min of inactivity.
        </p>

        <p className="text-center text-xs text-ghost-muted mt-2 opacity-50">
          crafted by <span className="text-ghost-subtle">Pratham</span>
        </p>
      </div>
    </div>
  );
}
