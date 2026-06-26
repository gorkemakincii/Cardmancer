import type { Card } from '../types';

// ── Card metadata ─────────────────────────────────────────────────────────────
// NOTE: Card artwork is intentionally a placeholder for now — real art + animations
// will be dropped in later. Only the value/name are used to render cards today.

export const CARD_CONFIG: Record<number, { name: string }> = {
  0:  { name: 'Royal Robovac' },
  1:  { name: 'Crystal Bowl' },
  2:  { name: 'Mouse Trapper' },
  3:  { name: 'Battle Bunny' },
  4:  { name: 'Shell Shield' },
  5:  { name: 'Snake Sorcerer' },
  6:  { name: 'Grave Digger' },
  7:  { name: 'Jittery Juggler' },
  8:  { name: 'Hermit Swap' },
  9:  { name: 'Not A Pet!' },
  10: { name: 'King Cat' },
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

// ── Face-down card (placeholder back) ──────────────────────────────────────────

export function FaceDownCard({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-14 rounded-lg border-2' : 'w-20 h-28 rounded-xl border-[3px]';
  return (
    <div className={`${dim} border-arcade-ink bg-arcade-ink relative overflow-hidden flex items-center justify-center shrink-0 select-none`}>
      <div className="absolute inset-1 rounded-md border border-arcade-cream/15" />
      <span className={`font-display font-extrabold text-arcade-cream/30 ${size === 'sm' ? 'text-base' : 'text-2xl'}`}>?</span>
    </div>
  );
}

// ── Playing card (placeholder face) ─────────────────────────────────────────────

interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md';
}

export function PlayingCard({ card, size = 'md' }: PlayingCardProps) {
  const name = CARD_CONFIG[card.value]?.name ?? '';

  if (size === 'sm') {
    return (
      <div className="w-10 h-14 rounded-lg border-2 border-arcade-ink bg-arcade-cream text-arcade-ink relative overflow-hidden shrink-0 select-none flex items-center justify-center">
        <span className="absolute top-0.5 left-1 font-display font-extrabold text-[10px] leading-none">{card.value}</span>
        <span className="font-display font-extrabold text-xl leading-none">{card.value}</span>
      </div>
    );
  }

  // md — placeholder face: big value, name strip, art slot to be filled in later
  return (
    <div className="w-20 h-28 rounded-xl border-[3px] border-arcade-ink bg-arcade-cream text-arcade-ink shadow-hard-sm relative overflow-hidden select-none">
      <span className="absolute top-1.5 left-2 font-display font-extrabold text-sm leading-none">{card.value}</span>
      <span className="absolute bottom-1.5 right-2 font-display font-extrabold text-sm leading-none rotate-180">{card.value}</span>

      {/* Placeholder art slot (real artwork goes here later) */}
      <div className="absolute inset-x-2 top-5 bottom-6 rounded-md border-2 border-dashed border-arcade-ink/20 bg-arcade-ink/[0.06] flex items-center justify-center">
        <span className="font-display font-extrabold text-3xl opacity-70">{card.value}</span>
      </div>

      <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-bold uppercase tracking-wide opacity-55 px-1 leading-tight">
        {name}
      </span>
    </div>
  );
}
