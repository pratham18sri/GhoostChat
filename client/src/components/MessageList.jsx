import { useEffect, useRef } from 'react';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SystemMessage({ text }) {
  return (
    <div className="msg-system animate-fade-in">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ghost-surface border border-ghost-border text-ghost-subtle text-xs">
        <span className="w-1 h-1 rounded-full bg-ghost-subtle inline-block" />
        {text}
      </span>
    </div>
  );
}

function MessageBubble({ msg, isOwn }) {
  return (
    <div className={`flex items-end gap-2 msg-pop ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
        ${isOwn ? 'bg-ghost-accent' : 'bg-ghost-muted'}`}>
        {msg.sender?.[0]?.toUpperCase() || '?'}
      </div>

      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name */}
        {!isOwn && (
          <span className="text-xs font-medium text-ghost-subtle ml-1">{msg.sender}</span>
        )}

        {/* Bubble */}
        <div className={isOwn ? 'msg-own' : 'msg-other'}>
          {msg.decryptFailed ? (
            <span className="text-ghost-subtle italic text-xs">{msg.content}</span>
          ) : (
            msg.content
          )}
        </div>

        {/* Timestamp + E2E badge */}
        <div className={`flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-ghost-muted">{formatTime(msg.timestamp)}</span>
          {msg.encrypted && (
            <span className="text-[10px] text-ghost-accent" title="End-to-end encrypted">
              🔒
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ messages, currentName }) {
  const bottomRef = useRef(null);
  const listRef   = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!bottomRef.current) return;
    const list = listRef.current;
    // Only auto-scroll if user is near the bottom (within 150px)
    const nearBottom = list
      ? list.scrollHeight - list.scrollTop - list.clientHeight < 150
      : true;

    if (nearBottom) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-ghost-subtle">
        <div className="text-4xl mb-3 opacity-30">👻</div>
        <p className="text-sm">No messages yet.</p>
        <p className="text-xs mt-1 opacity-60">Be the first to whisper…</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide"
    >
      {messages.map((msg) => {
        if (msg.type === 'system') {
          return <SystemMessage key={msg.id} text={msg.content} />;
        }
        return (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.sender === currentName}
          />
        );
      })}
      <div ref={bottomRef} className="h-px" />
    </div>
  );
}
