import { useState, useCallback, useEffect } from 'react';

const ADJECTIVES = ['DARK', 'VOID', 'NEON', 'ECHO', 'ZERO', 'FADE', 'MIST', 'DUST', 'HAZE', 'GLOW'];
const NOUNS      = ['WOLF', 'CROW', 'MOON', 'STAR', 'FIRE', 'REEF', 'VALE', 'COVE', 'PEAK', 'DUSK'];

function generateCode() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

function SkullIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="62" height="62" stroke="#00ff41" strokeWidth="1" fill="none" opacity="0.2"/>
      <path d="M32 8C19 8 10 17 10 29c0 7 3.5 13 9 17v6h26v-6c5.5-4 9-10 9-17C54 17 45 8 32 8z"
        fill="none" stroke="#00ff41" strokeWidth="1.5"/>
      <rect x="20" y="44" width="7" height="8" fill="#00ff41" opacity="0.8"/>
      <rect x="29" y="44" width="6" height="8" fill="#00ff41" opacity="0.8"/>
      <rect x="37" y="44" width="7" height="8" fill="#00ff41" opacity="0.8"/>
      <rect x="22" y="24" width="8" height="8" fill="#00ff41" opacity="0.9"/>
      <rect x="34" y="24" width="8" height="8" fill="#00ff41" opacity="0.9"/>
      <rect x="28" y="33" width="8" height="3" fill="#00ff41" opacity="0.4"/>
      <rect x="0" y="0" width="64" height="64" fill="none"
        stroke="#00ff41" strokeWidth="0.5" opacity="0.1" strokeDasharray="4 4"/>
    </svg>
  );
}

function Badge({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border border-ghost-border bg-ghost-surface text-ghost-subtle text-xs font-mono">
      <span className="text-ghost-accent">{icon}</span>
      <span className="uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function JoinRoom({ onJoin }) {
  const [name,     setName]     = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [e2e,      setE2e]      = useState(true);
  const [copied,   setCopied]   = useState(false);
  const [tick,     setTick]     = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const handleGenerate = useCallback(() => {
    setRoomCode(generateCode());
    setError('');
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setError('');

      const trimName = name.trim();
      const trimCode = roomCode.trim().toUpperCase();

      if (!trimName) { setError('OPERATOR ID required.'); return; }
      if (trimName.length < 1 || trimName.length > 30) { setError('ID must be 1–30 chars.'); return; }
      if (!trimCode) { setError('Channel key required.'); return; }
      if (!/^[A-Z0-9]{4,12}$/.test(trimCode)) { setError('Key must be 4–12 alphanumeric chars.'); return; }

      setLoading(true);
      onJoin({ name: trimName, roomCode: trimCode, e2e });
    },
    [name, roomCode, e2e, onJoin],
  );

  const handleRoomCodeInput = (v) => {
    setRoomCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 12));
    setError('');
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  useEffect(() => {
    if (error) setLoading(false);
  }, [error]);

  const now = new Date();
  const timestamp = `${now.toISOString().slice(0,10)} ${now.toTimeString().slice(0,8)}`;

  return (
    <div className="grid-bg radial-glow min-h-screen flex flex-col items-center justify-center p-4">
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full bg-green-900/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs text-ghost-subtle font-mono">SYS::{timestamp}</span>
          <span className="text-xs text-ghost-accent font-mono animate-pulse">● ONLINE</span>
        </div>

        {/* Header */}
        <div className="text-center mb-6 border border-ghost-border bg-ghost-card px-4 py-5"
             style={{boxShadow:'0 0 40px rgba(0,255,65,0.05)'}}>
          <div className="flex justify-center mb-3">
            <div className="ghost-float">
              <SkullIcon />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-widest mb-1 animate-glitch">
            <span className="gradient-text">GHOOST</span>
            <span className="text-ghost-subtle font-light">CHAT</span>
          </h1>
          <p className="text-ghost-subtle text-xs font-mono mt-2 tracking-widest uppercase">
            &gt; Encrypted. Ephemeral. Untraceable.
          </p>
          <div className="mt-3 text-[10px] text-ghost-subtle font-mono opacity-50 tracking-widest">
            ══════════════════════════════
          </div>
        </div>

        {/* Card */}
        <div className="ghost-card p-6 animate-pulse-glow">

          {/* Terminal header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-ghost-border">
            <span className="text-ghost-accent text-xs font-mono tracking-widest">&gt;_ ESTABLISH SECURE CHANNEL</span>
            <span className="animate-blink text-ghost-accent text-xs">█</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-ghost-subtle mb-2">
                <span className="text-ghost-accent">[01]</span> OPERATOR ID
              </label>
              <input
                className="ghost-input"
                type="text"
                placeholder="e.g. PHANTOM_X"
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
              <label className="block text-xs font-mono uppercase tracking-widest text-ghost-subtle mb-2">
                <span className="text-ghost-accent">[02]</span> CHANNEL KEY
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className="ghost-input pr-10 tracking-widest text-ghost-glow uppercase"
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
                      title="Copy key"
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
                  className="px-4 py-3 border border-ghost-border bg-ghost-surface text-ghost-subtle
                             hover:border-ghost-accent hover:text-ghost-text transition-all duration-200
                             text-xs font-mono uppercase tracking-widest whitespace-nowrap"
                  title="Generate random key"
                >
                  &gt; RNG
                </button>
              </div>
              <p className="text-xs text-ghost-subtle mt-1.5 ml-1 font-mono">
                // share key with target operatives only
              </p>
            </div>

            {/* E2E toggle */}
            <div className="flex items-center justify-between border border-ghost-border bg-ghost-surface px-4 py-3">
              <div>
                <p className="text-sm font-mono text-ghost-text uppercase tracking-widest">E2E Encryption</p>
                <p className="text-xs text-ghost-subtle mt-0.5 font-mono">// server cannot read payload</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={e2e}
                onClick={() => setE2e(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center transition-colors duration-200 focus:outline-none
                  ${e2e ? 'bg-ghost-accent' : 'bg-ghost-muted'}`}
                style={{borderRadius:0}}
              >
                <span
                  className={`inline-block h-4 w-4 bg-black shadow transition-transform duration-200
                    ${e2e ? 'translate-x-6' : 'translate-x-1'}`}
                  style={{borderRadius:0}}
                />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 border border-red-800/60 bg-red-950/30 px-3 py-2.5 animate-fade-in">
                <span className="text-red-400 text-xs font-mono">[ERR]</span>
                <p className="text-sm text-red-400 font-mono">{error}</p>
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
                  CONNECTING...
                </>
              ) : (
                <>&gt;_ ACCESS CHANNEL</>
              )}
            </button>
          </form>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Badge icon="[X]" label="No Accounts" />
          <Badge icon="[M]" label="RAM Only"    />
          <Badge icon="[~]" label="Auto-Wipe"   />
          <Badge icon="[E]" label="E2E Cipher"  />
        </div>

        <p className="text-center text-xs text-ghost-subtle mt-3 font-mono">
          // channels destroyed on exit or after 30 min idle
        </p>

        {/* Footer */}
        <p className="text-center text-[10px] text-ghost-subtle mt-3 font-mono tracking-widest opacity-40">
          GHOOSTCHAT v1.0 — crafted by <span className="text-ghost-accent opacity-80">PRATHAM</span>
        </p>
      </div>
    </div>
  );
}
