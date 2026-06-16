import { motion } from 'framer-motion';
import type { Card } from '../types';

// ── Card metadata ─────────────────────────────────────────────────────────────

interface CardConfig {
  emoji: string;
  gradient: string;
  border: string;
  glow: string;
}

export const CARD_CONFIG: Record<number, CardConfig & { name: string }> = {
  0:  { emoji: '🤖', name: 'Royal Robovac',   gradient: 'from-slate-400 via-slate-500 to-gray-700',       border: 'border-slate-300', glow: 'shadow-slate-400/50'  },
  1:  { emoji: '🔮', name: 'Crystal Bowl',    gradient: 'from-sky-300 via-sky-500 to-blue-700',           border: 'border-sky-300',   glow: 'shadow-sky-400/50'    },
  2:  { emoji: '🪤', name: 'Mouse Trapper',   gradient: 'from-zinc-500 via-zinc-600 to-zinc-800',         border: 'border-zinc-400',  glow: 'shadow-zinc-500/40'   },
  3:  { emoji: '🐰', name: 'Battle Bunny',    gradient: 'from-yellow-400 via-yellow-500 to-amber-700',    border: 'border-yellow-300',glow: 'shadow-yellow-400/50' },
  4:  { emoji: '🛡️', name: 'Shell Shield',    gradient: 'from-blue-400 via-blue-600 to-indigo-800',       border: 'border-blue-300',  glow: 'shadow-blue-400/50'   },
  5:  { emoji: '🐍', name: 'Snake Sorcerer',  gradient: 'from-green-500 via-green-700 to-emerald-900',    border: 'border-green-400', glow: 'shadow-green-500/50'  },
  6:  { emoji: '🦴', name: 'Grave Digger',    gradient: 'from-amber-600 via-amber-800 to-stone-900',      border: 'border-amber-500', glow: 'shadow-amber-500/50'  },
  7:  { emoji: '🤹', name: 'Jittery Juggler', gradient: 'from-pink-400 via-pink-600 to-fuchsia-800',      border: 'border-pink-400',  glow: 'shadow-pink-400/50'   },
  8:  { emoji: '🔄', name: 'Hermit Swap',     gradient: 'from-orange-400 via-orange-600 to-amber-900',    border: 'border-orange-300',glow: 'shadow-orange-400/50' },
  9:  { emoji: '🚫', name: 'Not A Pet!',      gradient: 'from-purple-500 via-violet-700 to-purple-950',   border: 'border-purple-400',glow: 'shadow-purple-400/50' },
  10: { emoji: '👑', name: 'King Cat',        gradient: 'from-red-500 via-red-700 to-rose-950',           border: 'border-red-400',   glow: 'shadow-red-400/50'    },
};

export const CARD_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(CARD_CONFIG).map(([v, c]) => [Number(v), c.name]),
);

export const CARD_DESC: Record<number, string> = {
  0:  'Tur sonunda, 0 oynayan TEK KİŞİ sensen elindeki karta bakılmaksızın turu kazanırsın.',
  1:  'Hedef kartını tahmin et — doğruysa elenir (1 tahminilemez)',
  2:  'Seçtiğin bir oyuncunun elindeki karta gizlice bak.',
  3:  'Hedef ile karşılaştır — düşük olan elenir',
  4:  'Bu tur boyunca hedef alınamazsın',
  5:  'Hedef kartını atar ve yeni kart çeker',
  6:  'Gizli kartı gör — elindekiyle takas (isteğe bağlı)',
  7:  'Herkes (korunanlar hariç) yeni kart çeker',
  8:  'Hedef ile elleri takas et',
  9:  'Hedef King Cat (10) tutuyorsa takas et',
  10: '⚠️ Oynayan elenir!',
};

// ── Face-down card ────────────────────────────────────────────────────────────

export function FaceDownCard({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-14' : 'w-20 h-28';
  return (
    <div className={`${dim} rounded-xl border-2 border-purple-700 bg-gradient-to-b from-purple-900 via-brand-dark to-indigo-950 shadow-lg flex items-center justify-center relative overflow-hidden flex-shrink-0`}>
      <div className="absolute inset-1 rounded-lg border border-purple-800/40" />
      <span className="text-purple-500 text-xl relative z-10">🐾</span>
    </div>
  );
}

// ── Playing card ──────────────────────────────────────────────────────────────

interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md';
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
}

export function PlayingCard({ card, size = 'md', selected = false, selectable = false, onClick }: PlayingCardProps) {
  const cfg = CARD_CONFIG[card.value] ?? CARD_CONFIG[0];

  if (size === 'sm') {
    return (
      <div className={`
        w-10 h-14 rounded-xl border-2 ${cfg.border} bg-gradient-to-b ${cfg.gradient}
        shadow-lg relative overflow-hidden flex-shrink-0 select-none
      `}>
        <div className="absolute inset-1 rounded-lg border border-white/10" />
        <div className="absolute top-0.5 left-1 text-white font-black text-xs leading-none">{card.value}</div>
        <div className="absolute inset-0 flex items-center justify-center text-xl">{cfg.emoji}</div>
        <div className="absolute bottom-0.5 right-1 text-white font-black text-xs leading-none rotate-180">{card.value}</div>
      </div>
    );
  }

  // md — full playing card with corner pips
  return (
    <motion.button
      onClick={onClick}
      disabled={!selectable}
      animate={selected ? { y: -14, scale: 1.09 } : { y: 0, scale: 1 }}
      whileHover={selectable && !selected ? { y: -5, scale: 1.03 } : {}}
      whileTap={selectable ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`
        w-20 h-28 rounded-xl border-2 ${cfg.border} bg-gradient-to-b ${cfg.gradient}
        shadow-xl ${cfg.glow} relative overflow-hidden select-none
        ${selectable ? 'cursor-pointer' : 'cursor-default'}
        ${selected ? 'ring-4 ring-white/80 ring-offset-2 ring-offset-brand-dark' : ''}
      `}
    >
      {/* Inner border for depth */}
      <div className="absolute inset-[3px] rounded-lg border border-white/10 pointer-events-none" />

      {/* Top-left pip */}
      <div className="absolute top-1.5 left-2 flex flex-col items-start z-10 leading-none">
        <span className="text-white font-black text-base drop-shadow">{card.value}</span>
        <span className="text-sm leading-none">{cfg.emoji}</span>
      </div>

      {/* Center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[32px] drop-shadow-lg">{cfg.emoji}</span>
      </div>

      {/* Card name */}
      <div className="absolute bottom-5 inset-x-0 flex justify-center pointer-events-none">
        <span className="text-[7px] text-white/55 font-medium text-center px-1 leading-tight">{cfg.name}</span>
      </div>

      {/* Bottom-right pip (180°) */}
      <div className="absolute bottom-1.5 right-2 flex flex-col items-end z-10 leading-none rotate-180">
        <span className="text-white font-black text-base drop-shadow">{card.value}</span>
        <span className="text-sm leading-none">{cfg.emoji}</span>
      </div>
    </motion.button>
  );
}
