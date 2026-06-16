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
    <>
      {/* Toggle button — bottom-left (global mute lives bottom-right) */}
      <button
        onClick={() => { playClick(); setOpen(o => !o); }}
        title="Sohbet"
        className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-brand-card border border-purple-700 hover:border-purple-400 hover:bg-purple-900/50 flex items-center justify-center text-lg shadow-lg transition-all select-none"
      >
        💬
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
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
            className="fixed bottom-16 left-4 z-50 w-[88vw] max-w-xs h-[60vh] max-h-[26rem] bg-brand-card border border-purple-600 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-700 shrink-0">
              <span className="text-white font-semibold text-sm flex items-center gap-1.5">💬 Sohbet</span>
              <button
                onClick={() => { playClick(); setOpen(false); }}
                aria-label="Kapat"
                className="text-purple-400 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-purple-900/50 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {messages.length === 0 && (
                <p className="text-purple-500 text-xs text-center py-8 px-2">
                  Henüz mesaj yok. Bir şeyler yaz ya da aşağıdan hızlı emoji gönder! 🐾
                </p>
              )}
              {messages.map((m, i) => {
                const mine = m.socketId === mySocketId;
                const emojiOnly = isEmojiOnly(m.message);
                return (
                  <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && <span className="text-purple-400 text-[10px] px-1 mb-0.5">{m.username}</span>}
                    <div
                      className={
                        emojiOnly
                          ? 'text-3xl px-1 leading-none'
                          : `px-2.5 py-1.5 rounded-xl text-sm max-w-[85%] break-words ${
                              mine ? 'bg-brand-primary text-white' : 'bg-purple-900/50 text-purple-100'
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
            <div className="px-2 py-1.5 border-t border-purple-800 grid grid-cols-6 gap-0.5 shrink-0">
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => sendEmoji(e)}
                  className="text-xl h-8 flex items-center justify-center rounded-lg hover:bg-purple-900/50 hover:scale-110 active:scale-95 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-2 border-t border-purple-700 flex gap-2 shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                maxLength={200}
                placeholder="Mesaj yaz..."
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-brand-dark border border-purple-700 text-white placeholder-purple-500 text-sm focus:outline-none focus:border-brand-primary"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Gönder"
                className="px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
              >
                ➤
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
