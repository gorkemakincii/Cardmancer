import type { CSSProperties } from 'react';
import type { Card } from '../types';
import cardBackUrl from '../assets/card-back.png';

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

// ── Card sizing ─────────────────────────────────────────────────────────────
// One design, three widths. All inner sizing is in cqw (% of card width) so the
// proportions hold at every size — the card is its own container (container-type).

type CardSize = 'sm' | 'md' | 'lg';
const CARD_WIDTH: Record<CardSize, string> = {
  sm: 'w-12',        // ~48px — table / face-up cascades / end-of-game hands
  md: 'w-28',        // ~112px — modals, deck pile, game-over winner
  lg: 'w-[150px]',   // hand cards
};

// Outer sizer: fixes the card's width + 5:7 ratio and declares it the query
// container. The gold frame lives in a child so its cqw padding resolves against
// THIS element's width (cqw refers to the nearest ancestor container, not self).
function cardSizer(size: CardSize, extra = '') {
  return `${CARD_WIDTH[size]} aspect-[5/7] shrink-0 select-none relative ${extra}`;
}
const SIZER_STYLE: CSSProperties = { containerType: 'size' };

// ── Face-down card (shared "CARDMANCER" back) ──────────────────────────────────

export function FaceDownCard({ size = 'sm' }: { size?: CardSize }) {
  return (
    <div className={cardSizer(size)} style={SIZER_STYLE}>
      <div className="w-full h-full rounded-[7%] cm-gold shadow-hard-sm relative" style={{ padding: '4cqw' }}>
        <div className="w-full h-full rounded-[5%] overflow-hidden relative bg-arcade-bg">
          <img src={cardBackUrl} alt="" draggable={false} className="w-full h-full object-cover select-none" />
          {/* Crisp CARDMANCER wordmark overlaid on the AI-generated back */}
          <div className="absolute inset-x-[4%] bottom-[6%] flex justify-center">
            <span
              className="font-display font-extrabold tracking-tight text-[#FCE08A] leading-none whitespace-nowrap"
              style={{ fontSize: '9cqw', textShadow: '0 1px 2px #14110F, 1px 1px 0 #14110F' }}
            >
              CARDMANCER
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Playing card (Hearthstone-style gold face) ──────────────────────────────────

interface PlayingCardProps {
  card: Card;
  size?: CardSize;
}

export function PlayingCard({ card, size = 'md' }: PlayingCardProps) {
  const name = CARD_CONFIG[card.value]?.name ?? '';
  const desc = CARD_DESC[card.value] ?? '';
  const art = CARD_ART[card.value];

  // Compact mini — gold frame + art + corner value gem, no banner/description.
  if (size === 'sm') {
    return (
      <div className={cardSizer(size)} style={SIZER_STYLE}>
        <div className="w-full h-full rounded-[8%] cm-gold shadow-hard-sm relative" style={{ padding: '5cqw' }}>
          <div className="w-full h-full rounded-[6%] overflow-hidden relative bg-arcade-bg cm-parchment">
            {art ? (
              <img src={art} alt={name} draggable={false} className="w-full h-full object-cover select-none" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display font-extrabold text-[#4A3712]" style={{ fontSize: '34cqw' }}>
                {card.value}
              </div>
            )}
          </div>
          <div
            className="cm-gem absolute -left-[6%] -top-[6%] rounded-full flex items-center justify-center border-2 border-[#FCE08A] shadow-hard-sm"
            style={{ width: '40cqw', height: '40cqw' }}
          >
            <span className="font-display font-extrabold text-white leading-none" style={{ fontSize: '22cqw', textShadow: '0 1px 1px #14110F' }}>
              {card.value}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full Hearthstone-style card (md / lg) — art on top, name ribbon, description.
  return (
    <div className={cardSizer(size)} style={SIZER_STYLE}>
      <div className="w-full h-full rounded-[7%] cm-gold shadow-hard-sm relative" style={{ padding: '4cqw' }}>
        {/* Parchment paper */}
        <div className="w-full h-full rounded-[5%] cm-parchment relative overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px rgba(122,90,18,0.55)' }}>
          {/* Art window */}
          <div
            className="absolute left-[7%] right-[7%] top-[6%] h-[50%] rounded-[12%] overflow-hidden bg-arcade-bg"
            style={{ boxShadow: '0 0 0 2px #8A6314, 0 0 0 4px rgba(253,232,154,0.7)' }}
          >
            {art ? (
              <img src={art} alt={name} draggable={false} className="w-full h-full object-cover select-none" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display font-extrabold text-arcade-cream/80" style={{ fontSize: '26cqw' }}>
                {card.value}
              </div>
            )}
          </div>

          {/* Name ribbon */}
          <div
            className="cm-ribbon absolute left-[1%] right-[1%] top-[57%] h-[13%] flex items-center justify-center border-y-2 border-[#8A6314]"
            style={{ boxShadow: '0 2px 4px rgba(20,17,15,0.35)' }}
          >
            <span className="font-display font-extrabold text-[#3A2A08] leading-none text-center px-[4%] truncate" style={{ fontSize: '9cqw' }}>
              {name}
            </span>
          </div>

          {/* Description */}
          <div className="absolute left-[7%] right-[7%] top-[72%] bottom-[5%] flex items-center justify-center text-center">
            <span className="text-[#4A3712] font-semibold leading-tight" style={{ fontSize: '6.4cqw' }}>
              {desc}
            </span>
          </div>
        </div>

        {/* Value cost gem — top-left */}
        <div
          className="cm-gem absolute -left-[4%] -top-[4%] rounded-full flex items-center justify-center border-2 border-[#FCE08A] shadow-hard-sm"
          style={{ width: '30cqw', height: '30cqw' }}
        >
          <span className="font-display font-extrabold text-white leading-none" style={{ fontSize: '17cqw', textShadow: '0 1px 2px #14110F' }}>
            {card.value}
          </span>
        </div>
      </div>
    </div>
  );
}
