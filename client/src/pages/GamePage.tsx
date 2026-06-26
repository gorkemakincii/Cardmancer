import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import { socket } from '../socket';
import { playClick, playDraw, playPlayCard, playEliminate, playWin } from '../audio';
import { PlayingCard, FaceDownCard, CARD_CONFIG, CARD_NAMES, CARD_DESC } from '../components/PlayingCard';
import { ChatPanel } from '../components/ChatPanel';
import { setActiveRoom, clearActiveRoom, getActiveRoom } from '../session';
import type { ActionPromptEvent, Card, GameOverData, PlayerGameView, PlayerPublicView, PrivateRevealEvent } from '../types';

const CARDS_NEEDING_TARGET = new Set([1, 2, 3, 5, 8, 9]);

// ── Modal state ──────────────────────────────────────────────────────────────

type ModalState =
  | { kind: 'target'; cardId: string; cardValue: number }
  | { kind: 'guess'; cardId: string; targetPlayerId: string }
  | { kind: 'grave_digger'; revealedCard: Card };

// Pointer position (viewport coords) from a Framer drag-end event.
function pointerXY(e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): { x: number; y: number } {
  const anyE = e as { clientX?: number; clientY?: number; changedTouches?: TouchList };
  if (typeof anyE.clientX === 'number' && typeof anyE.clientY === 'number') {
    return { x: anyE.clientX, y: anyE.clientY };
  }
  if (anyE.changedTouches && anyE.changedTouches[0]) {
    return { x: anyE.changedTouches[0].clientX, y: anyE.changedTouches[0].clientY };
  }
  return { x: info.point.x, y: info.point.y };
}

// ── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const particles = useRef(
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: 2 + (i * 2.7) % 96,
      color: ['#FF5C38', '#FFC94D', '#2EC4B6', '#FFF4E0', '#FF8A5C'][i % 5],
      duration: 2.2 + (i * 0.11) % 1.8,
      delay: (i * 0.07) % 1.0,
      size: 7 + (i * 3) % 8,
      shape: i % 3 === 0 ? 'rounded-none rotate-45' : 'rounded-full',
    })),
  ).current;
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className={`absolute ${p.shape}`}
          style={{ left: `${p.left}%`, bottom: 0, width: p.size, height: p.size, backgroundColor: p.color }}
          animate={{ y: '-110vh', rotate: [0, 360 * 3], opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut', repeat: Infinity, repeatDelay: p.delay + 0.3 }}
        />
      ))}
    </div>
  );
}

// ── Face-up cascade ───────────────────────────────────────────────────────────

function CardCascade({ cards }: { cards: Card[] }) {
  const rotations = [-4, 2, -3, 4, -2, 3, -5, 1];
  if (cards.length === 0) return null;
  return (
    <div className="flex items-end">
      {cards.map((c, i) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, x: -16, rotate: -15 }}
          animate={{ opacity: 1, x: 0, rotate: rotations[i % rotations.length] }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: i * 0.04 }}
          style={{ marginLeft: i > 0 ? -10 : 0, zIndex: i + 1 }}
          className="relative"
        >
          <PlayingCard card={c} size="sm" />
        </motion.div>
      ))}
    </div>
  );
}

// ── Deck pile ───────────────────────────────────────────────────────────────────

function DeckPile({ count, canDraw, onDraw }: { count: number; canDraw?: boolean; onDraw?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {count > 0 ? (
        <motion.button
          onClick={canDraw ? onDraw : undefined}
          disabled={!canDraw}
          animate={canDraw ? { y: [0, -4, 0] } : { y: 0 }}
          transition={canDraw ? { repeat: Infinity, duration: 1.4 } : {}}
          className={`relative w-20 h-28 ${canDraw ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="absolute top-2 left-2 w-20 h-28 rounded-xl border-[3px] border-arcade-ink bg-arcade-ink/70" />
          <div className="absolute top-1 left-1 w-20 h-28 rounded-xl border-[3px] border-arcade-ink bg-arcade-ink/85" />
          <div className={`absolute inset-0 rounded-xl ${canDraw ? 'ring-4 ring-arcade-sun ring-offset-2 ring-offset-arcade-bg' : ''}`}>
            <FaceDownCard size="md" />
          </div>
        </motion.button>
      ) : (
        <div className="w-20 h-28 rounded-xl border-[3px] border-dashed border-arcade-cream/25 flex items-center justify-center text-arcade-cream/40 text-xs font-bold">
          boş
        </div>
      )}
      <span className="text-arcade-cream/60 text-xs font-bold uppercase tracking-widest">Deste · {count}</span>
    </div>
  );
}

// ── Other player panel ────────────────────────────────────────────────────────

function OtherPlayerPanel({ player, isActive, index }: { player: PlayerPublicView; isActive: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`
        rounded-2xl p-3 relative overflow-hidden border-[3px]
        ${isActive ? 'bg-arcade-sun/20 border-arcade-sun' : 'bg-arcade-cream/[0.06] border-arcade-cream/15'}
        ${player.isEliminated ? 'opacity-45' : ''}
        ${!player.connected && !player.isEliminated ? 'opacity-70 grayscale' : ''}
      `}
    >
      <AnimatePresence>
        {player.isEliminated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-arcade-ink/55 flex items-center justify-center z-10 rounded-2xl"
          >
            <span className="text-arcade-coral font-display font-extrabold text-xs tracking-widest rotate-[-8deg] border-2 border-arcade-coral px-2 py-0.5 rounded">ELENDİ</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 mb-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-arcade-ink text-arcade-cream flex items-center justify-center text-xs font-display font-bold shrink-0">
          {player.username[0].toUpperCase()}
        </div>
        <span className="text-arcade-cream text-sm font-semibold truncate">{player.username}</span>
        {!player.connected && !player.isEliminated && (
          <span title="Bağlantısı koptu — geri dönmesi bekleniyor" className="text-arcade-sun text-[10px] font-bold shrink-0 border-2 border-arcade-sun/50 rounded px-1 py-0.5 leading-none">
            kopuk
          </span>
        )}
        {player.isProtected && (
          <motion.span
            animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }}
            title="Korunuyor" className="text-arcade-teal text-[10px] font-bold shrink-0 border-2 border-arcade-teal/50 rounded px-1 py-0.5 leading-none"
          >KALKAN</motion.span>
        )}
        {isActive && !player.isEliminated && (
          <motion.span
            animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}
            className="ml-auto text-arcade-sun text-xs font-bold shrink-0"
          >◀ sıra</motion.span>
        )}
      </div>

      <div className="flex items-end gap-1.5 flex-wrap">
        {Array.from({ length: player.handSize }).map((_, i) => (
          <FaceDownCard key={`h${i}`} size="sm" />
        ))}
        <CardCascade cards={player.faceUpCards} />
      </div>
    </motion.div>
  );
}

// ── Overlay backdrop ──────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-arcade-ink/85 backdrop-blur-sm flex items-center justify-center z-50 px-4 font-ui"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] p-6 w-full max-w-sm shadow-hard"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Target select modal ───────────────────────────────────────────────────────

function TargetSelectModal({ cardValue, targets, onSelect, onCancel }: {
  cardValue: number;
  targets: PlayerPublicView[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <Overlay>
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-lg bg-arcade-ink text-arcade-cream font-display font-extrabold flex items-center justify-center shrink-0">{cardValue}</span>
        <h3 className="font-display font-extrabold text-xl">Hedef seç</h3>
      </div>
      <p className="text-sm font-medium opacity-70 mb-4">{CARD_DESC[cardValue]}</p>
      <div className="space-y-2 mb-4">
        {targets.length === 0 && (
          <p className="text-sm text-center py-3 opacity-50 font-medium">Hedef alınabilecek oyuncu yok</p>
        )}
        {targets.map(p => (
          <button
            key={p.socketId}
            onClick={() => onSelect(p.socketId)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-[3px] transition-all text-left ${
              p.isProtected
                ? 'border-arcade-teal bg-arcade-teal/15 hover:bg-arcade-teal/25'
                : 'border-arcade-ink bg-white/55 hover:bg-arcade-sun/30'
            }`}
          >
            <div className="w-7 h-7 rounded-md bg-arcade-ink text-arcade-cream flex items-center justify-center text-xs font-display font-bold">
              {p.username[0].toUpperCase()}
            </div>
            <span className="font-semibold flex-1">{p.username}</span>
            {p.isProtected && <span className="text-xs font-bold text-arcade-teal">KALKAN</span>}
            <div className="flex gap-1">
              {Array.from({ length: p.handSize }).map((_, i) => (
                <div key={i} className="w-4 h-6 rounded-sm bg-arcade-ink/70" />
              ))}
            </div>
          </button>
        ))}
      </div>
      {targets.length === 0 ? (
        <button onClick={() => onSelect('')} className="btn-arcade w-full py-2.5 text-sm">Aksiyonsuz geç</button>
      ) : (
        <button onClick={onCancel} className="block mx-auto text-sm font-semibold underline decoration-2 underline-offset-2 opacity-70 hover:opacity-100 py-1">← İptal</button>
      )}
    </Overlay>
  );
}

// ── Guess select modal ────────────────────────────────────────────────────────

function GuessSelectModal({ onSelect, onCancel }: { onSelect: (v: number) => void; onCancel: () => void }) {
  const values = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <Overlay>
      <h3 className="font-display font-extrabold text-xl mb-1">Tahmin et</h3>
      <p className="text-sm font-medium opacity-70 mb-4">Hedefin elindeki kartın değerini tahmin et (1 seçilemez)</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {values.map(v => (
          <button
            key={v}
            onClick={() => onSelect(v)}
            title={CARD_CONFIG[v]?.name}
            className="h-14 rounded-xl border-[3px] border-arcade-ink bg-arcade-cream hover:bg-arcade-sun/40 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center font-display font-extrabold text-xl shadow-hard-sm"
          >
            {v}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="block mx-auto text-sm font-semibold underline decoration-2 underline-offset-2 opacity-70 hover:opacity-100 py-1">← Geri</button>
    </Overlay>
  );
}

// ── Grave digger modal ────────────────────────────────────────────────────────

function GraveDiggerModal({ revealedCard, onAccept, onDecline }: { revealedCard: Card; onAccept: () => void; onDecline: () => void }) {
  return (
    <Overlay>
      <h3 className="font-display font-extrabold text-xl mb-1">Mezar kazıcı</h3>
      <p className="text-sm font-medium opacity-70 mb-5">Gizli kart açıklandı. Elindekiyle takas etmek ister misin?</p>
      <div className="flex justify-center mb-6">
        <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.4 }}>
          <PlayingCard card={revealedCard} />
        </motion.div>
      </div>
      <div className="flex gap-3">
        <button onClick={onDecline} className="btn-arcade btn-arcade--cream flex-1 py-2.5">Hayır</button>
        <button onClick={onAccept} className="btn-arcade flex-1 py-2.5">Takas et</button>
      </div>
    </Overlay>
  );
}

// ── Game over screen ──────────────────────────────────────────────────────────

function GameOverScreen({ data, mySocketId, isHost, onRestart, onLeave }: {
  data: GameOverData;
  mySocketId: string;
  isHost: boolean;
  onRestart: () => void;
  onLeave: () => void;
}) {
  const iWon = data.winner?.socketId === mySocketId;
  const reasonMap: Record<string, string> = {
    deck_empty: 'Deste tükendi',
    last_player: 'Son oyuncu kaldı',
    no_next_player: 'Oyuncu kalmadı',
    disconnect: 'Bir oyuncu bağlantısını kesti',
  };

  return (
    <div className="arcade-stage min-h-screen font-ui text-arcade-cream">
      {iWon && <Confetti />}
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="w-full max-w-md text-center"
        >
          <motion.h2
            animate={iWon ? { rotate: [0, -3, 3, -2, 2, 0] } : {}}
            transition={{ duration: 0.6 }}
            className="title-arcade text-5xl mb-3"
            style={{ color: iWon ? '#FFC94D' : '#FFF4E0' }}
          >
            {iWon ? 'KAZANDIN!' : 'OYUN BİTTİ'}
          </motion.h2>
          <p className="text-sm font-medium text-arcade-cream/60 mb-6">{reasonMap[data.reason] ?? data.reason}</p>

          {data.winner && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-3 bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-2xl px-5 py-3 mb-6 shadow-hard-sm"
            >
              <span className="text-xs font-bold uppercase tracking-wide opacity-60">Kazanan</span>
              <span className="font-display font-extrabold">{data.winner.username}</span>
              {data.winner.hand[0] && <PlayingCard card={data.winner.hand[0]} size="sm" />}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] p-5 mb-6 text-left shadow-hard"
          >
            <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">Son eller</p>
            <div className="space-y-3">
              {data.players.map((p, i) => (
                <motion.div
                  key={p.socketId}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate">{p.username}</span>
                  <div className="flex gap-1 shrink-0">
                    {p.hand.map(c => <PlayingCard key={c.id} card={c} size="sm" />)}
                  </div>
                  {p.faceUpCards.length > 0 && (
                    <div className="flex border-l-2 border-arcade-ink/15 pl-2 shrink-0">
                      <CardCascade cards={p.faceUpCards} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className="space-y-3"
          >
            {isHost ? (
              <button onClick={onRestart} className="btn-arcade w-full py-3.5 text-lg">Tekrar oyna</button>
            ) : (
              <p className="text-sm font-medium text-arcade-cream/60 py-2">Hostun yeni oyunu başlatması bekleniyor…</p>
            )}
            <button
              onClick={onLeave}
              className="block mx-auto text-sm font-semibold text-arcade-cream/50 hover:text-arcade-cream underline decoration-2 underline-offset-2 py-2"
            >
              ← Ana sayfaya dön
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Main GamePage ─────────────────────────────────────────────────────────────

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locState = location.state as { gameView: PlayerGameView } | null;
  const [gameView, setGameView] = useState<PlayerGameView | null>(locState?.gameView ?? null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState('');
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);

  // Drag-to-play state
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const prevEliminatedRef = useRef<Set<string>>(new Set());
  const gameViewRef = useRef<PlayerGameView | null>(locState?.gameView ?? null);
  useEffect(() => { gameViewRef.current = gameView; }, [gameView]);

  useEffect(() => {
    if (!locState && getActiveRoom() !== roomCode) navigate('/');
  }, [locState, roomCode, navigate]);

  useEffect(() => {
    if (locState?.gameView) setGameView(locState.gameView);
  }, [locState]);

  useEffect(() => {
    if (roomCode) setActiveRoom(roomCode);
  }, [roomCode]);

  // ── Elimination detector ─────────────────────────────────────────────────
  function reportEliminations(newView: PlayerGameView) {
    for (const p of newView.players) {
      if (p.isEliminated && !prevEliminatedRef.current.has(p.socketId)) {
        playEliminate();
        const isMe = p.socketId === newView.mySocketId;
        toast.error(`💀 ${p.username}${isMe ? ' (sen)' : ''} elendi!`, { duration: 4000 });
      }
    }
    prevEliminatedRef.current = new Set(newView.players.filter(x => x.isEliminated).map(x => x.socketId));
  }

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    function onCardDrawn(data: { drawerId: string; gameView: PlayerGameView }) {
      const v = data.gameView;
      playDraw();
      if (data.drawerId !== v.mySocketId) {
        const p = v.players.find(x => x.socketId === data.drawerId);
        if (p) toast(`🎴 ${p.username} kart çekti`, { duration: 2000 });
      }
      setGameView(v);
      setError('');
    }

    function onCardPlayed(data: {
      playerId: string;
      card: Card;
      gameView: PlayerGameView;
      shieldBlocked?: boolean;
      guessInfo?: { targetName: string; guessValue: number; correct: boolean } | null;
    }) {
      const v = data.gameView;
      playPlayCard();
      reportEliminations(v);
      if (data.shieldBlocked) {
        toast('🛡️ Hamle kalkan tarafından engellendi!', { duration: 3000 });
      } else if (data.guessInfo) {
        const actor = v.players.find(x => x.socketId === data.playerId);
        const g = data.guessInfo;
        const name = CARD_NAMES[g.guessValue] ?? '';
        toast.info(
          `🔮 ${actor?.username ?? '?'}, ${g.targetName} oyuncusunun kartı için ${g.guessValue} (${name}) tahmininde bulundu — ${g.correct ? '✓ Doğru!' : '✗ Yanlış'}`,
          { duration: 5000 },
        );
      } else if (data.playerId !== v.mySocketId) {
        const p = v.players.find(x => x.socketId === data.playerId);
        const name = CARD_NAMES[data.card.value] ?? String(data.card.value);
        if (p) {
          if (data.card.value === 4) {
            toast.info(`🛡️ ${p.username} kalkanını açtı!`, { duration: 3000 });
          } else {
            toast.info(`⚡ ${p.username} — ${name} (${data.card.value})`, { duration: 3000 });
          }
        }
      }
      if (v.hasPendingAction && data.playerId !== v.mySocketId) {
        const p = v.players.find(x => x.socketId === data.playerId);
        if (p) toast(`⏳ ${p.username} aksiyonunu tamamlıyor...`, { duration: 5000 });
      }
      setGameView(v);
      setError('');
    }

    function onGameStateUpdated(v: PlayerGameView) {
      reportEliminations(v);
      setGameView(v);
    }

    function onActionPrompt(data: ActionPromptEvent) {
      if (data.type === 'grave_digger' && data.revealedCard) {
        setModal({ kind: 'grave_digger', revealedCard: data.revealedCard });
      }
    }

    function onPrivateReveal(data: PrivateRevealEvent) {
      const name = CARD_NAMES[data.cardValue] ?? '';
      toast.info(
        `🪤 Gizli bilgi: ${data.targetName} adlı kişinin elindeki kart — ${data.cardValue} (${name})`,
        { duration: 8000 },
      );
    }

    function onActionResolved(data: { gameView: PlayerGameView }) {
      const v = data.gameView;
      reportEliminations(v);
      setGameView(v);
      setModal(null);
      setError('');
    }

    function onGameOver(data: GameOverData) {
      playWin();
      clearActiveRoom();
      setGameOver(data);
      setModal(null);
      if (data.winner) {
        const isMe = data.winner.socketId === (gameViewRef.current?.mySocketId ?? '');
        if (isMe) toast.success('🏆 Tebrikler, kazandın!', { duration: 5000 });
        else toast.error(`Oyun bitti! Kazanan: ${data.winner.username}`, { duration: 5000 });
      }
    }

    function onRoomStateUpdated(state: { status: string; roomCode: string }) {
      if (state.status === 'WAITING') {
        navigate(`/lobby/${state.roomCode}`, { state: { gameState: state, username: '' } });
      }
    }

    function onGameError(data: { message: string }) {
      setError(data.message);
      setTimeout(() => setError(''), 3500);
    }

    socket.on('card_drawn', onCardDrawn);
    socket.on('card_played', onCardPlayed);
    socket.on('game_state_updated', onGameStateUpdated);
    socket.on('action_prompt', onActionPrompt);
    socket.on('action_resolved', onActionResolved);
    socket.on('private_reveal', onPrivateReveal);
    socket.on('room_state_updated', onRoomStateUpdated);
    socket.on('game_over', onGameOver);
    socket.on('game_error', onGameError);

    return () => {
      socket.off('card_drawn', onCardDrawn);
      socket.off('card_played', onCardPlayed);
      socket.off('game_state_updated', onGameStateUpdated);
      socket.off('action_prompt', onActionPrompt);
      socket.off('action_resolved', onActionResolved);
      socket.off('private_reveal', onPrivateReveal);
      socket.off('room_state_updated', onRoomStateUpdated);
      socket.off('game_over', onGameOver);
      socket.off('game_error', onGameError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!roomCode) return null;
  if (!gameView) {
    return (
      <div className="arcade-stage min-h-screen flex flex-col items-center justify-center gap-4 px-4 font-ui">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 rounded-xl border-[3px] border-arcade-cream/30 border-t-arcade-coral"
        />
        <p className="text-arcade-cream/70 font-medium">Oyuna yeniden bağlanılıyor…</p>
      </div>
    );
  }

  const mySocketId = socket.id ?? gameView.mySocketId;
  const isMyTurn = gameView.activePlayerId === mySocketId;
  const otherPlayers = gameView.players.filter(p => p.socketId !== mySocketId);
  const activePlayer = gameView.players.find(p => p.socketId === gameView.activePlayerId);
  const targetablePlayers = gameView.players.filter(p => !p.isEliminated && p.socketId !== mySocketId);

  const canDraw = isMyTurn && gameView.phase === 'draw' && !gameView.hasPendingAction;
  const canPlay = isMyTurn && gameView.phase === 'play' && !gameView.hasPendingAction;
  const hoveredCard = gameView.myHand.find(c => c.id === hoveredCardId) ?? null;

  // ── Play action handlers ─────────────────────────────────────────────────

  function handleDrawCard() {
    if (!canDraw) return;
    playClick();
    socket.emit('draw_card', { roomCode });
  }

  function playCard(card: Card) {
    if (!canPlay) return;
    playClick();
    if (CARDS_NEEDING_TARGET.has(card.value)) {
      setModal({ kind: 'target', cardId: card.id, cardValue: card.value });
    } else {
      socket.emit('play_card', { roomCode, cardId: card.id });
    }
  }

  function handleDragEnd(e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, card: Card) {
    setIsDragging(false);
    setHoveredCardId(null);
    const zone = dropRef.current?.getBoundingClientRect();
    if (!zone) return;
    const { x, y } = pointerXY(e, info);
    if (x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom) {
      playCard(card);
    }
  }

  function handleTargetSelected(targetPlayerId: string) {
    if (!modal || modal.kind !== 'target') return;
    playClick();
    if (modal.cardValue === 1) {
      setModal({ kind: 'guess', cardId: modal.cardId, targetPlayerId });
    } else {
      socket.emit('play_card', { roomCode, cardId: modal.cardId, targetPlayerId: targetPlayerId || undefined });
      setModal(null);
    }
  }

  function handleGuessSelected(guessValue: number) {
    if (!modal || modal.kind !== 'guess') return;
    playClick();
    socket.emit('play_card', { roomCode, cardId: modal.cardId, targetPlayerId: modal.targetPlayerId, guessValue });
    setModal(null);
  }

  function handleLeave() {
    playClick();
    socket.emit('leave_game', { roomCode });
    clearActiveRoom();
    navigate('/');
  }

  function handleRestart() { playClick(); socket.emit('restart_game', { roomCode }); }

  // ── Game over ────────────────────────────────────────────────────────────

  if (gameOver) {
    const amHost = gameView?.players.find(p => p.socketId === mySocketId)?.isHost ?? false;
    return (
      <GameOverScreen
        data={gameOver}
        mySocketId={mySocketId}
        isHost={amHost}
        onRestart={handleRestart}
        onLeave={handleLeave}
      />
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="arcade-stage min-h-screen flex flex-col px-4 py-4 font-ui text-arcade-cream">
      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1">

        {/* Compact info widget — fixed top-left */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-3 left-3 z-40 flex items-center rounded-xl bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink shadow-hard-sm px-3 py-2"
        >
          {([['Tur', gameView.roundNumber, false], ['Oda', roomCode, true], ['Deste', gameView.deckSize, false]] as const).map(([label, val, accent], i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <div className="mx-2.5 h-7 w-px bg-arcade-ink/20" />}
              <div className="flex flex-col items-center leading-none gap-0.5">
                <span className="opacity-55 text-[9px] font-bold uppercase tracking-[0.18em]">{label}</span>
                <span className={`font-display font-extrabold text-lg ${accent ? 'text-arcade-coral tracking-[0.12em]' : ''}`}>{val}</span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Turn status */}
        <motion.div
          layout
          className={`text-center py-2.5 px-4 rounded-xl mb-4 text-sm font-bold border-[3px] ${
            isMyTurn
              ? 'bg-arcade-coral text-arcade-ink border-arcade-ink'
              : 'bg-arcade-cream/[0.06] text-arcade-cream/70 border-arcade-cream/15'
          }`}
        >
          {isMyTurn
            ? gameView.hasPendingAction ? 'Aksiyonunu tamamla…'
              : gameView.phase === 'draw' ? 'Sıra sende — desteden kart çek!'
              : 'Sıra sende — kartı masaya sürükle!'
            : activePlayer && !activePlayer.connected
              ? `${activePlayer.username} bağlantısı koptu — bekleniyor…`
              : `${activePlayer?.username ?? '?'} oynuyor…`}
        </motion.div>

        {/* Other players */}
        {otherPlayers.length > 0 && (
          <div className={`grid gap-3 ${otherPlayers.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {otherPlayers.map((p, i) => (
              <OtherPlayerPanel key={p.socketId} player={p} isActive={p.socketId === gameView.activePlayerId} index={i} />
            ))}
          </div>
        )}

        {/* Center table — drop zone for drag-to-play */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-4">
          {gameView.twoPlayerFaceUpCards.length > 0 && (
            <div className="flex items-end justify-center gap-3">
              {gameView.twoPlayerFaceUpCards.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 16, rotate: -10 }}
                  animate={{ opacity: 1, y: 0, rotate: [-3, 2, -2][i % 3] }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: i * 0.05 }}
                >
                  <PlayingCard card={c} size="sm" />
                </motion.div>
              ))}
            </div>
          )}

          <motion.div
            ref={dropRef}
            animate={isDragging ? { scale: 1.03 } : { scale: 1 }}
            className={`relative w-full max-w-sm rounded-[24px] border-[3px] border-dashed flex items-center justify-center text-center px-6 py-12 transition-colors ${
              isDragging
                ? 'border-arcade-coral bg-arcade-coral/15'
                : canPlay
                  ? 'border-arcade-cream/35 bg-arcade-cream/[0.04]'
                  : 'border-arcade-cream/15'
            }`}
          >
            <div>
              <p className="font-display font-extrabold text-lg text-arcade-cream/80">
                {isDragging ? 'Bırak ve oyna!' : canPlay ? 'Kartı buraya sürükle' : 'Masa'}
              </p>
              {canPlay && !isDragging && (
                <p className="text-xs font-medium text-arcade-cream/45 mt-1">Oynamak için elindeki kartı buraya bırak</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* My hand */}
        <div className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] p-5 shadow-hard">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-extrabold text-lg">Elin</h3>
            <span className="text-sm font-bold opacity-60">{gameView.myHand.length} kart</span>
          </div>

          {/* Hover/drag hint description */}
          <div className="min-h-[1.25rem] mb-2 text-center">
            <AnimatePresence mode="wait">
              {hoveredCard && (
                <motion.p
                  key={hoveredCard.id}
                  initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs font-medium opacity-75"
                >
                  <span className="font-display font-bold">{CARD_NAMES[hoveredCard.value]}</span> — {CARD_DESC[hoveredCard.value]}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Hand cards — draggable when it's your play phase */}
          <div className="flex gap-5 justify-center mb-4 min-h-[7.5rem] items-end">
            <AnimatePresence mode="popLayout">
              {gameView.myHand.map(card => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 30, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  drag={canPlay}
                  dragSnapToOrigin
                  dragElastic={0.18}
                  onDragStart={() => { setIsDragging(true); setHoveredCardId(card.id); }}
                  onDragEnd={(e, info) => handleDragEnd(e, info, card)}
                  whileDrag={{ scale: 1.12, zIndex: 60, cursor: 'grabbing' }}
                  whileHover={canPlay ? { y: -20, scale: 1.06 } : {}}
                  onHoverStart={() => setHoveredCardId(card.id)}
                  onHoverEnd={() => { if (!isDragging) setHoveredCardId(null); }}
                  className={canPlay ? 'cursor-grab' : ''}
                  style={{ touchAction: 'none' }}
                >
                  <PlayingCard card={card} />
                </motion.div>
              ))}
            </AnimatePresence>
            {gameView.myHand.length === 0 && (
              <p className="text-sm font-medium opacity-50">Elde kart yok</p>
            )}
          </div>

          {/* Action row */}
          <div className="flex justify-center">
            {canDraw && (
              <button onClick={handleDrawCard} className="btn-arcade px-8 py-3">Kart çek</button>
            )}
            {canPlay && (
              <p className="text-sm font-medium opacity-60 py-2">Bir kartı yukarıdaki masaya sürükle</p>
            )}
            {(!isMyTurn || gameView.hasPendingAction) && (
              <div className="flex items-center gap-2 text-sm font-medium opacity-55 py-2">
                <motion.span
                  animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                  className="w-2 h-2 rounded-full bg-arcade-ink/60"
                />
                {gameView.hasPendingAction && isMyTurn ? 'Aksiyonunu seç…' : 'Diğer oyuncunun sırası…'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-5 py-3 bg-arcade-coral text-arcade-ink border-[3px] border-arcade-ink rounded-xl text-sm font-bold shadow-hard-sm z-50"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modal?.kind === 'target' && (
          <TargetSelectModal
            cardValue={modal.cardValue}
            targets={targetablePlayers}
            onSelect={handleTargetSelected}
            onCancel={() => setModal(null)}
          />
        )}
        {modal?.kind === 'guess' && (
          <GuessSelectModal
            onSelect={handleGuessSelected}
            onCancel={() => setModal({ kind: 'target', cardId: modal.cardId, cardValue: 1 })}
          />
        )}
        {modal?.kind === 'grave_digger' && (
          <GraveDiggerModal
            revealedCard={modal.revealedCard}
            onAccept={() => { playClick(); socket.emit('action_response', { roomCode, type: 'grave_digger', accept: true }); setModal(null); }}
            onDecline={() => { playClick(); socket.emit('action_response', { roomCode, type: 'grave_digger', accept: false }); setModal(null); }}
          />
        )}
      </AnimatePresence>

      {/* Deck pile — pinned right-center */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40">
        <DeckPile count={gameView.deckSize} canDraw={canDraw} onDraw={handleDrawCard} />
      </div>

      {/* In-game chat & quick emojis */}
      <ChatPanel roomCode={roomCode} mySocketId={mySocketId} />
    </div>
  );
}
