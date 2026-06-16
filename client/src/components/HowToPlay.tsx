import { motion } from 'framer-motion';
import { PlayingCard, CARD_CONFIG, CARD_DESC } from './PlayingCard';

// Deck distribution (matches server/src/gameEngine.ts createDeck)
const CARD_COUNTS: Record<number, number> = {
  0: 3, 1: 5, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
};

const RULES: { icon: string; text: string }[] = [
  { icon: '🎯', text: 'Amaç: Tur sonunda elinde EN YÜKSEK değerli kartı tutan oyuncu ol — ya da diğer herkesi ele.' },
  { icon: '🃏', text: '2-6 oyuncu. Oyun başında herkese 1 gizli kart dağıtılır.' },
  { icon: '🎴', text: 'Sıran gelince desteden 1 kart çekersin; elinde 2 kart olur.' },
  { icon: '⚡', text: 'Bu 2 karttan birini oynar ve etkisini uygularsın. Diğeri elinde kalır.' },
  { icon: '👁️', text: 'Oynanan kartlar önünde açık kalır — herkes ne oynadığını görebilir.' },
  { icon: '💀', text: 'Bir kartın etkisiyle elenirsen o tur boyunca oyun dışı kalırsın.' },
  { icon: '🏁', text: 'Deste tükenirse ya da tek oyuncu kalırsa tur biter ve kazanan belli olur.' },
  { icon: '⚠️', text: 'Yüksek kart güçlüdür ama tehlikelidir: King Cat (10) elinde kalırsa avantajlısın, ama oynamak zorunda kalırsan elenirsin!' },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-brand-card border border-purple-600 rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-700 shrink-0">
          <h2 className="text-white font-bold text-xl font-game flex items-center gap-2">
            <span>📖</span> Nasıl Oynanır?
          </h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg text-purple-400 hover:text-white hover:bg-purple-900/50 flex items-center justify-center transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">

          {/* Game flow */}
          <section>
            <h3 className="text-brand-secondary font-bold text-sm uppercase tracking-widest mb-3">
              🎮 Oyunun İşleyişi
            </h3>
            <ul className="space-y-2.5">
              {RULES.map((r, i) => (
                <li key={i} className="flex gap-3 text-purple-200 text-sm leading-snug">
                  <span className="shrink-0 text-base leading-none mt-0.5">{r.icon}</span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Cards */}
          <section>
            <h3 className="text-brand-secondary font-bold text-sm uppercase tracking-widest mb-3">
              🃏 Kartlar
              <span className="text-purple-500 font-normal normal-case tracking-normal ml-2 text-xs">
                (düşük değer = yaygın · yüksek değer = güçlü)
              </span>
            </h3>
            <div className="space-y-2">
              {Array.from({ length: 11 }, (_, v) => v).map((value) => {
                const cfg = CARD_CONFIG[value];
                return (
                  <div
                    key={value}
                    className="flex gap-3 items-center bg-purple-900/20 border border-purple-800 rounded-xl p-2.5"
                  >
                    <div className="shrink-0">
                      <PlayingCard card={{ id: `htp-${value}`, value }} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold text-sm">
                          {value} · {cfg.name}
                        </span>
                        <span className="text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full border border-purple-700 bg-purple-900/40 shrink-0">
                          ×{CARD_COUNTS[value]}
                        </span>
                      </div>
                      <p className="text-purple-300 text-xs leading-snug mt-0.5">
                        {CARD_DESC[value]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-purple-700 shrink-0">
          <button onClick={onClose} className="btn-primary w-full">
            Anladım, Oynayalım! 🐾
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
