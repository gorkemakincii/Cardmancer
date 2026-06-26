import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { socket } from '../socket';
import { playClick } from '../audio';
import type { ChatMessage } from '../types';

const QUICK_EMOJIS = ['👍', '😂', '😮', '😎', '😢', '😡', '🎉', '🤔', '💀', '🐾', '🔥', '🍀'];

// Render lone-emoji messages larger (heuristic: short + no latin letters/digits)
function isEmojiOnly(s: string): boolean {
  const t = s.trim();
  if (!t || /[a-zA-Z0-9]/.test(t)) return false;
  return [...t].length <= 6;
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5Z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h13M11 6l6 6-6 6" />
    </svg>
  );
}

export function ChatPanel({ roomCode, mySocketId }: { roomCode: string; mySocketId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  // Listen for incoming chat messages
  useEffect(() => {
    function onChat(msg: ChatMessage) {
      setMessages(prev => [...prev.slice(-49), msg]);
      if (!openRef.current && msg.socketId !== mySocketId) setUnread(u => u + 1);
    }
    socket.on('chat_message', onChat);
    return () => { socket.off('chat_message', onChat); };
  }, [mySocketId]);

  // Auto-scroll to bottom on new message / open
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, open]);

  // Clear unread badge when opened
  useEffect(() => { if (open) setUnread(0); }, [open]);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat_message', { roomCode, message: t });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
    setInput('');
  }

  function sendEmoji(emoji: string) {
    playClick();
    send(emoji);
  }

  return (
    <div className="font-ui">
      {/* Toggle button — bottom-left (global mute lives bottom-right) */}
      <button
        onClick={() => { playClick(); setOpen(o => !o); }}
        title="Sohbet"
        className="fixed bottom-4 left-4 z-50 w-12 h-12 rounded-xl bg-arcade-coral text-arcade-ink border-[3px] border-arcade-ink shadow-hard-sm flex items-center justify-center transition-transform hover:-translate-y-0.5 select-none"
      >
        <ChatIcon />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 rounded-full bg-arcade-ink text-arcade-cream border-2 border-arcade-cream text-[10px] font-bold flex items-center justify-center"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -20, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-20 left-4 z-50 w-[88vw] max-w-xs h-[60vh] max-h-[26rem] bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[20px] shadow-hard flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-[3px] border-arcade-ink shrink-0">
              <span className="font-display font-extrabold text-sm flex items-center gap-2"><ChatIcon /> Sohbet</span>
              <button
                onClick={() => { playClick(); setOpen(false); }}
                aria-label="Kapat"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-arcade-ink text-arcade-cream hover:bg-arcade-coral hover:text-arcade-ink transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {messages.length === 0 && (
                <p className="text-xs text-center py-8 px-2 font-medium opacity-50">
                  Henüz mesaj yok. Bir şeyler yaz ya da aşağıdan hızlı emoji gönder.
                </p>
              )}
              {messages.map((m, i) => {
                const mine = m.socketId === mySocketId;
                const emojiOnly = isEmojiOnly(m.message);
                return (
                  <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && <span className="text-[10px] px-1 mb-0.5 font-semibold opacity-50">{m.username}</span>}
                    <div
                      className={
                        emojiOnly
                          ? 'text-3xl px-1 leading-none'
                          : `px-2.5 py-1.5 rounded-xl text-sm font-medium max-w-[85%] break-words border-2 ${
                              mine
                                ? 'bg-arcade-coral text-arcade-ink border-arcade-ink'
                                : 'bg-white text-arcade-ink border-arcade-ink/15'
                            }`
                      }
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick emojis */}
            <div className="px-2 py-1.5 border-t-2 border-arcade-ink/15 grid grid-cols-6 gap-0.5 shrink-0">
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => sendEmoji(e)}
                  className="text-xl h-8 flex items-center justify-center rounded-lg hover:bg-arcade-sun/40 active:scale-95 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-2 border-t-[3px] border-arcade-ink flex gap-2 shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                maxLength={200}
                placeholder="Mesaj yaz…"
                className="input-arcade flex-1 min-w-0 px-3 py-2 text-sm font-medium"
                style={{ boxShadow: '3px 3px 0 0 #14110F' }}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Gönder"
                className="px-3 rounded-xl bg-arcade-coral text-arcade-ink border-[3px] border-arcade-ink font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-transform flex items-center justify-center"
              >
                <SendIcon />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
