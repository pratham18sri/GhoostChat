import { useState, useRef, useCallback, useEffect } from 'react';

const MAX_LEN          = 500;
const TYPING_DEBOUNCE  = 1_500; // ms before sending typing_stop

export default function MessageInput({ onSend, onTypingStart, onTypingStop, disabled, rateLimited, resetInMs }) {
  const [text,      setText]      = useState('');
  const [isTyping,  setIsTyping]  = useState(false);
  const typingTimer = useRef(null);
  const textareaRef = useRef(null);

  const stopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      onTypingStop?.();
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, [isTyping, onTypingStop]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    if (val.length > MAX_LEN) return;
    setText(val);

    if (val && !isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }
    if (!val) {
      stopTyping();
      return;
    }

    // Debounce typing stop
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_DEBOUNCE);
  }, [isTyping, stopTyping, onTypingStart]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled || rateLimited) return;
    onSend(trimmed);
    setText('');
    stopTyping();
    textareaRef.current?.focus();
  }, [text, disabled, rateLimited, onSend, stopTyping]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Cleanup on unmount
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  const remaining = MAX_LEN - text.length;
  const nearLimit = remaining <= 80;

  return (
    <div className="border-t border-ghost-border bg-ghost-surface/80 backdrop-blur-sm p-3">
      {/* Rate-limited banner */}
      {rateLimited && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-700/40 animate-fade-in">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          <span className="text-xs text-amber-400">
            Slow down! Resetting in {Math.ceil(resetInMs / 1000)}s…
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            disabled={disabled || rateLimited}
            rows={1}
            className="w-full resize-none rounded-xl border border-ghost-border bg-ghost-card
                       px-4 py-3 pr-16 text-sm text-ghost-text placeholder-ghost-muted
                       transition-all duration-200 max-h-32 overflow-y-auto scrollbar-hide
                       focus:outline-none focus:border-ghost-accent focus:ring-1 focus:ring-ghost-accent
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              height: 'auto',
              minHeight: '48px',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          {/* Char counter */}
          {nearLimit && (
            <span className={`absolute bottom-2 right-3 text-[10px] font-mono ${remaining <= 20 ? 'text-red-400' : 'text-ghost-subtle'}`}>
              {remaining}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled || rateLimited}
          className="shrink-0 w-11 h-11 rounded-xl bg-ghost-accent hover:bg-ghost-accent2
                     flex items-center justify-center transition-all duration-200
                     disabled:opacity-30 disabled:cursor-not-allowed
                     active:scale-90 focus:outline-none focus:ring-2 focus:ring-ghost-glow"
          style={{ boxShadow: text.trim() ? '0 0 16px rgba(124,58,237,0.4)' : 'none' }}
          title="Send message (Enter)"
        >
          <svg className="w-5 h-5 text-white -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-ghost-muted mt-1.5 ml-1">
        Shift+Enter for new line · Messages are not stored
      </p>
    </div>
  );
}
