import { motion } from 'framer-motion';
import { PlayingCard, CARD_CONFIG, CARD_DESC } from './PlayingCard';

// Deck distribution (matches server/src/gameEngine.ts createDeck)
const CARD_COUNTS: Record<number, number> = {
  0: 3, 1: 5, 2: 3, 3: 3, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
};

const RULES: string[] = [
  'Amaç: Tur sonunda elinde EN YÜKSEK değerli kartı tutan oyuncu ol — ya da diğer herkesi ele.',
  '2-6 oyuncu. Oyun başında herkese 1 gizli kart dağıtılır.',
  'Sıran gelince desteden 1 kart çekersin; elinde 2 kart olur.',
  'Bu 2 karttan birini oynar ve etkisini uygularsın. Diğeri elinde kalır.',
  'Oynanan kartlar önünde açık kalır — herkes ne oynadığını görebilir.',
  'Bir kartın etkisiyle elenirsen o tur boyunca oyun dışı kalırsın.',
  'Deste tükenirse ya da tek oyuncu kalırsa tur biter ve kazanan belli olur.',
  'Yüksek kart güçlüdür ama tehlikelidir: Nekomata Emperor (10) elinde kalırsa avantajlısın, ama oynamak zorunda kalırsan elenirsin!',
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 mb-4">
      <span className="font-display font-extrabold uppercase tracking-wide text-sm text-arcade-ink">
        {children}
      </span>
      <span className="flex-1 h-[3px] bg-arcade-coral rounded-full" />
    </h3>
  );
}

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-arcade-ink/85 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6 font-ui"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] w-full max-w-lg max-h-[88vh] flex flex-col shadow-hard overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-arcade-ink shrink-0">
          <h2 className="font-display font-extrabold text-2xl">Nasıl oynanır?</h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-9 h-9 rounded-xl bg-arcade-ink text-arcade-cream hover:bg-arcade-coral hover:text-arcade-ink flex items-center justify-center transition-colors text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-7">

          {/* Game flow — an ordered briefing, so numbered markers carry real meaning */}
          <section>
            <SectionLabel>Oyunun işleyişi</SectionLabel>
            <ol className="space-y-2.5">
              {RULES.map((text, i) => (
                <li key={i} className="flex gap-3 text-sm leading-snug">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-arcade-ink text-arcade-cream font-display font-bold text-xs flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="font-medium pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Cards */}
          <section>
            <SectionLabel>Kartlar</SectionLabel>
            <p className="text-xs font-medium opacity-60 -mt-2 mb-3">
              düşük değer = yaygın · yüksek değer = güçlü
            </p>
            <div className="space-y-2">
              {Array.from({ length: 11 }, (_, v) => v).map((value) => {
                const cfg = CARD_CONFIG[value];
                return (
                  <div
                    key={value}
                    className="flex gap-3 items-center bg-white/55 border-2 border-arcade-ink/15 rounded-xl p-2.5"
                  >
                    <div className="shrink-0">
                      <PlayingCard card={{ id: `htp-${value}`, value }} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm">
                          {value} · {cfg.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-arcade-ink bg-arcade-sun shrink-0">
                          ×{CARD_COUNTS[value]}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-snug mt-0.5 opacity-80">
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
        <div className="px-6 py-4 border-t-[3px] border-arcade-ink shrink-0">
          <button onClick={onClose} className="btn-arcade w-full py-3">
            Anladım, başlayalım
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
