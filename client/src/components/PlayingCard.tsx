import type { Card } from '../types';

// ── Card metadata ─────────────────────────────────────────────────────────────
// Card artwork lives in ../assets/cards/{value}.png (cute enamel-pin yokai/ninja
// theme). The art is collected at build time via Vite's import.meta.glob; cards
// without a matching image gracefully fall back to a value placeholder.

export const CARD_CONFIG: Record<number, { name: string }> = {
  0:  { name: 'Kage Kit' },
  1:  { name: 'Mystic Neko' },
  2:  { name: 'Fukurou Seer' },
  3:  { name: 'Samurai Usagi' },
  4:  { name: 'Zen Kappa' },
  5:  { name: 'Kamaitachi' },
  6:  { name: 'Mogura' },
  7:  { name: 'Kemuri Neko' },
  8:  { name: 'Raijin Scroll' },
  9:  { name: 'Bakedanuki Bandit' },
  10: { name: 'Nekomata Emperor' },
};

export const CARD_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(CARD_CONFIG).map(([v, c]) => [Number(v), c.name]),
);

// Build-time map of card value → artwork URL. Missing values simply stay undefined.
const CARD_ART_MODULES = import.meta.glob('../assets/cards/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const CARD_ART: Record<number, string> = Object.fromEntries(
  Object.entries(CARD_ART_MODULES).map(([path, url]) => {
    const value = Number(path.match(/(\d+)\.\w+$/)?.[1]);
    return [value, url];
  }),
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
  9:  'Hedef Nekomata Emperor (10) tutuyorsa takas et',
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
  const art = CARD_ART[card.value];

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

      {/* Art window — illustrated card art, or a value placeholder when missing */}
      <div className="absolute inset-x-2 top-5 bottom-6 rounded-md overflow-hidden border-2 border-arcade-ink/70 bg-arcade-bg flex items-center justify-center">
        {art ? (
          <img src={art} alt={name} draggable={false} className="w-full h-full object-cover select-none" />
        ) : (
          <span className="font-display font-extrabold text-3xl text-arcade-cream/80">{card.value}</span>
        )}
      </div>

      <span className="absolute bottom-1 inset-x-0 text-center text-[7px] font-bold uppercase tracking-wide opacity-55 px-1 leading-tight">
        {name}
      </span>
    </div>
  );
}
