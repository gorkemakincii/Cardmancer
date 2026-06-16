import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

// ── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  const particles = useMemo(() =>
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: 2 + (i * 2.7) % 96,
      color: ['#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899', '#F97316'][i % 7],
      duration: 2.2 + (i * 0.11) % 1.8,
      delay: (i * 0.07) % 1.0,
      size: 7 + (i * 3) % 8,
      shape: i % 3 === 0 ? 'rounded-none rotate-45' : 'rounded-full',
    })), [],
  );
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

// ── Deck pile (center of the table) ─────────────────────────────────────────────

function DeckPile({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {count > 0 ? (
        <div className="relative w-20 h-28">
          <div className="absolute top-2 left-2 w-20 h-28 rounded-xl border-2 border-purple-800 bg-brand-dark/70" />
          <div className="absolute top-1 left-1 w-20 h-28 rounded-xl border-2 border-purple-800 bg-brand-dark/85" />
          <div className="absolute inset-0"><FaceDownCard size="md" /></div>
        </div>
      ) : (
        <div className="w-20 h-28 rounded-xl border-2 border-dashed border-purple-800 flex items-center justify-center text-purple-600 text-xs">
          boş
        </div>
      )}
      <span className="text-purple-400 text-xs uppercase tracking-widest">Deste · {count}</span>
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
        rounded-xl p-3 transition-all relative overflow-hidden
        ${isActive ? 'bg-amber-900/20 shadow-soft-amber' : 'bg-brand-card shadow-soft'}
        ${player.isEliminated ? 'opacity-40' : ''}
        ${!player.connected && !player.isEliminated ? 'opacity-70 grayscale' : ''}
      `}
    >
      {/* Elimination overlay */}
      <AnimatePresence>
        {player.isEliminated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl"
          >
            <span className="text-red-400 font-black text-xs tracking-widest rotate-[-8deg] border border-red-500 px-2 py-0.5 rounded">ELENDİ</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 mb-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
          {player.username[0].toUpperCase()}
        </div>
        <span className="text-white text-sm font-medium truncate">{player.username}</span>
        {!player.connected && !player.isEliminated && (
          <span
            title="Bağlantısı koptu — geri dönmesi bekleniyor"
            className="text-amber-400 text-[10px] font-bold shrink-0 border border-amber-500/50 rounded px-1 py-0.5 leading-none"
          >
            📡 kopuk
          </span>
        )}
        {player.isProtected && (
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            title="Korunuyor" className="text-blue-300 text-sm shrink-0"
          >🛡️</motion.span>
        )}
        {player.isHost && <span className="text-brand-secondary text-xs shrink-0">👑</span>}
        {isActive && !player.isEliminated && (
          <motion.span
            animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}
            className="ml-auto text-brand-secondary text-xs font-bold shrink-0"
          >◀</motion.span>
        )}
      </div>

      <div className="flex items-end gap-1.5 flex-wrap">
        {/* Face-down hand cards */}
        {Array.from({ length: player.handSize }).map((_, i) => (
          <FaceDownCard key={`h${i}`} size="sm" />
        ))}
        {/* Face-up played cards cascade */}
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
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 px-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="bg-brand-card border border-purple-600 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
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
  const cfg = CARD_CONFIG[cardValue];
  return (
    <Overlay>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{cfg?.emoji}</span>
        <h3 className="text-white font-bold text-lg">Hedef Seç</h3>
      </div>
      <p className="text-purple-400 text-sm mb-4">{CARD_DESC[cardValue]}</p>
      <div className="space-y-2 mb-4">
        {targets.length === 0 && (
          <p className="text-purple-500 text-sm text-center py-3">Hedef alınabilecek oyuncu yok</p>
        )}
        {targets.map(p => (
          <button
            key={p.socketId}
            onClick={() => onSelect(p.socketId)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left cursor-pointer
              ${p.isProtected
                ? 'border-blue-600 bg-blue-900/25 hover:border-blue-400 hover:bg-blue-900/40'
                : 'border-purple-700 bg-purple-900/30 hover:border-brand-secondary hover:bg-amber-900/20'}
            `}
          >
            <div className="w-7 h-7 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-bold">
              {p.username[0].toUpperCase()}
            </div>
            <span className="text-white font-medium flex-1">{p.username}</span>
            {p.isProtected && <span className="text-blue-300 text-sm">🛡️ Korunuyor</span>}
            <div className="flex gap-1">
              {Array.from({ length: p.handSize }).map((_, i) => (
                <div key={i} className="w-4 h-6 rounded bg-purple-700" />
              ))}
            </div>
          </button>
        ))}
      </div>
      {targets.length === 0 ? (
        <button onClick={() => onSelect('')} className="btn-primary w-full py-2 text-sm">Aksiyonsuz Geç</button>
      ) : (
        <button onClick={onCancel} className="w-full text-purple-400 hover:text-white text-sm py-2 transition-colors">← İptal</button>
      )}
    </Overlay>
  );
}

// ── Guess select modal ────────────────────────────────────────────────────────

function GuessSelectModal({ onSelect, onCancel }: { onSelect: (v: number) => void; onCancel: () => void }) {
  const values = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <Overlay>
      <h3 className="text-white font-bold text-lg mb-1">🔮 Tahmin Et</h3>
      <p className="text-purple-400 text-sm mb-4">Hedefin elindeki kartın değerini tahmin et (1 seçilemez)</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {values.map(v => {
          const cfg = CARD_CONFIG[v];
          return (
            <button
              key={v}
              onClick={() => onSelect(v)}
              className={`
                h-14 rounded-xl border-2 ${cfg.border} bg-gradient-to-b ${cfg.gradient}
                flex flex-col items-center justify-center text-white font-black text-lg
                hover:scale-105 active:scale-95 transition-transform
              `}
            >
              <span>{v}</span>
              <span className="text-xs leading-none">{cfg.emoji}</span>
            </button>
          );
        })}
      </div>
      <button onClick={onCancel} className="w-full text-purple-400 hover:text-white text-sm py-2 transition-colors">← Geri</button>
    </Overlay>
  );
}

// ── Grave digger modal ────────────────────────────────────────────────────────

function GraveDiggerModal({ revealedCard, onAccept, onDecline }: { revealedCard: Card; onAccept: () => void; onDecline: () => void }) {
  return (
    <Overlay>
      <h3 className="text-white font-bold text-lg mb-1">🦴 Doggy Grave Digger</h3>
      <p className="text-purple-400 text-sm mb-5">Gizli kart açıklandı. Elindekiyle takas etmek ister misin?</p>
      <div className="flex justify-center mb-6">
        <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.4 }}>
          <PlayingCard card={revealedCard} />
        </motion.div>
      </div>
      <div className="flex gap-3">
        <button onClick={onDecline} className="flex-1 btn-secondary py-2">Hayır</button>
        <button onClick={onAccept} className="flex-1 btn-primary py-2">Takas Et ↔</button>
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
    <>
      {iWon && <Confetti />}
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="w-full max-w-md text-center"
        >
          <motion.div
            animate={iWon ? { rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.6 }}
            className="text-7xl mb-4"
          >
            {iWon ? '🏆' : '💔'}
          </motion.div>
          <h2 className="text-4xl font-bold font-game text-white mb-2">
            {iWon ? 'Kazandın!' : 'Oyun Bitti'}
          </h2>
          <p className="text-purple-400 text-sm mb-6">{reasonMap[data.reason] ?? data.reason}</p>

          {data.winner && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-3 bg-amber-900/30 border border-brand-secondary rounded-xl px-5 py-3 mb-6"
            >
              <span className="text-brand-secondary text-lg">👑</span>
              <span className="text-white font-semibold">{data.winner.username}</span>
              {data.winner.hand[0] && <PlayingCard card={data.winner.hand[0]} size="sm" />}
            </motion.div>
          )}

          {/* Final hands */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="bg-brand-card border border-purple-700 rounded-2xl p-5 mb-6 text-left"
          >
            <p className="text-purple-400 text-xs uppercase tracking-widest mb-4">Son Eller</p>
            <div className="space-y-3">
              {data.players.map((p, i) => (
                <motion.div
                  key={p.socketId}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-white text-sm flex-1 min-w-0 truncate">{p.username}</span>
                  <div className="flex gap-1 shrink-0">
                    {p.hand.map(c => <PlayingCard key={c.id} card={c} size="sm" />)}
                  </div>
                  {p.faceUpCards.length > 0 && (
                    <div className="flex border-l border-purple-700 pl-2 shrink-0">
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
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={onRestart}
                className="btn-primary w-full text-lg"
              >
                🔄 Tekrar Oyna
              </motion.button>
            ) : (
              <p className="text-purple-400 text-sm text-center py-2">
                ⏳ Hostun yeni oyunu başlatması bekleniyor...
              </p>
            )}
            <button
              onClick={onLeave}
              className="w-full text-purple-400 hover:text-white text-sm py-2 transition-colors"
            >
              🏠 Ana Sayfaya Dön
            </button>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}

// ── Main GamePage ─────────────────────────────────────────────────────────────

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locState = location.state as { gameView: PlayerGameView } | null;
  const [gameView, setGameView] = useState<PlayerGameView | null>(locState?.gameView ?? null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState('');
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);

  // Ref to detect newly eliminated players between renders
  const prevEliminatedRef = useRef<Set<string>>(new Set());
  const gameViewRef = useRef<PlayerGameView | null>(locState?.gameView ?? null);
  useEffect(() => { gameViewRef.current = gameView; }, [gameView]);

  // Bounce home only when there's no view AND no reconnect pending for this room.
  useEffect(() => {
    if (!locState && getActiveRoom() !== roomCode) navigate('/');
  }, [locState, roomCode, navigate]);

  // Pick up a fresh view delivered via navigation (initial load or reconnect).
  useEffect(() => {
    if (locState?.gameView) setGameView(locState.gameView);
  }, [locState]);

  // Remember this as the active game so a refresh/drop can reconnect to it.
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
        const cfg = CARD_CONFIG[g.guessValue];
        toast.info(
          `🔮 ${actor?.username ?? '?'}, ${g.targetName} oyuncusunun kartı için ${g.guessValue} (${cfg?.name ?? ''}) tahmininde bulundu — ${g.correct ? '✓ Doğru!' : '✗ Yanlış'}`,
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
      setSelectedCardId(null);
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
      const cfg = CARD_CONFIG[data.cardValue];
      toast.info(
        `🪤 Gizli Bilgi: ${data.targetName} adlı kişinin elindeki kart — ${cfg?.emoji ?? ''} ${data.cardValue} (${cfg?.name ?? ''})`,
        { duration: 8000 },
      );
    }

    function onActionResolved(data: { gameView: PlayerGameView }) {
      const v = data.gameView;
      reportEliminations(v);
      setGameView(v);
      setModal(null);
      setSelectedCardId(null);
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
    // Reconnecting (e.g. after a refresh/drop) — App's resume hook delivers the view.
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-5xl"
        >
          🐾
        </motion.div>
        <p className="text-purple-300">Oyuna yeniden bağlanılıyor...</p>
      </div>
    );
  }

  const mySocketId = socket.id ?? gameView.mySocketId;
  const isMyTurn = gameView.activePlayerId === mySocketId;
  const otherPlayers = gameView.players.filter(p => p.socketId !== mySocketId);
  const activePlayer = gameView.players.find(p => p.socketId === gameView.activePlayerId);
  const targetablePlayers = gameView.players.filter(p => !p.isEliminated && p.socketId !== mySocketId);

  // ── Play action handlers ─────────────────────────────────────────────────

  function handleDrawCard() {
    playClick();
    socket.emit('draw_card', { roomCode });
  }

  function handlePlayCardClick() {
    if (!selectedCardId) return;
    const card = gameView!.myHand.find(c => c.id === selectedCardId);
    if (!card) return;
    playClick();
    if (CARDS_NEEDING_TARGET.has(card.value)) {
      setModal({ kind: 'target', cardId: selectedCardId, cardValue: card.value });
    } else {
      socket.emit('play_card', { roomCode, cardId: selectedCardId });
      setSelectedCardId(null);
    }
  }

  function handleTargetSelected(targetPlayerId: string) {
    if (!modal || modal.kind !== 'target') return;
    playClick();
    if (modal.cardValue === 1) {
      setModal({ kind: 'guess', cardId: modal.cardId, targetPlayerId });
    } else {
      socket.emit('play_card', { roomCode, cardId: modal.cardId, targetPlayerId: targetPlayerId || undefined });
      setModal(null); setSelectedCardId(null);
    }
  }

  function handleGuessSelected(guessValue: number) {
    if (!modal || modal.kind !== 'guess') return;
    playClick();
    socket.emit('play_card', { roomCode, cardId: modal.cardId, targetPlayerId: modal.targetPlayerId, guessValue });
    setModal(null); setSelectedCardId(null);
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
    <div className="min-h-screen flex flex-col px-4 py-4 max-w-2xl mx-auto">

      {/* Compact info widget — fixed in the top-left corner */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed top-3 left-3 z-40 flex items-center rounded-xl bg-brand-card/85 backdrop-blur-md shadow-soft px-3 py-2"
      >
        <span className="text-xl mr-2.5 leading-none">🐾</span>
        {([['Tur', gameView.roundNumber, false], ['Oda', roomCode, true], ['Deste', gameView.deckSize, false]] as const).map(([label, val, accent], i) => (
          <div key={label} className="flex items-center">
            {i > 0 && <div className="mx-2.5 h-7 w-px bg-purple-700/50" />}
            <div className="flex flex-col items-center leading-none gap-0.5">
              <span className="text-purple-400 text-[9px] uppercase tracking-[0.18em]">{label}</span>
              <span className={`font-bold text-lg ${accent ? 'text-brand-secondary tracking-[0.15em]' : 'text-white'}`}>{val}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Turn status */}
      <motion.div
        layout
        className={`
          text-center py-2 px-4 rounded-xl mb-4 text-sm font-medium
          ${isMyTurn
            ? 'bg-brand-primary/30 border border-brand-primary text-white'
            : 'bg-brand-card border border-purple-700 text-purple-400'}
          ${isMyTurn && !gameView.hasPendingAction ? 'animate-breathe' : ''}
        `}
      >
        {isMyTurn
          ? gameView.hasPendingAction ? '⏳ Aksiyonunu tamamla...'
            : gameView.phase === 'draw' ? '🎴 Sıra sende — Kart çek!'
            : '🎯 Sıra sende — Kart oyna!'
          : activePlayer && !activePlayer.connected
            ? `📡 ${activePlayer.username} bağlantısı koptu — geri dönmesi bekleniyor...`
            : `${activePlayer?.username ?? '?'} oynuyor...`}
      </motion.div>

      {/* Other players — top zone, kept near the top edge */}
      {otherPlayers.length > 0 && (
        <div className={`grid gap-3 ${otherPlayers.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {otherPlayers.map((p, i) => (
            <OtherPlayerPanel key={p.socketId} player={p} isActive={p.socketId === gameView.activePlayerId} index={i} />
          ))}
        </div>
      )}

      {/* Center table — only the played face-up cards, vertically centered */}
      <div className="flex-1 flex items-center justify-center py-4">
        {gameView.twoPlayerFaceUpCards.length > 0 && (
          <div className="bg-brand-card rounded-2xl px-6 py-4 shadow-soft">
            <p className="text-purple-400 text-xs uppercase tracking-widest mb-3 text-center">Açık Kartlar</p>
            <div className="flex items-end justify-center gap-3 scale-110 origin-center">
              {gameView.twoPlayerFaceUpCards.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 16, rotate: -10 }}
                  animate={{ opacity: 1, y: 0, rotate: [-3, 2, -2][i % 3] }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: i * 0.05 }}
                >
                  <PlayingCard card={c} size="md" />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* My hand — bottom zone, kept near the bottom edge */}
      <div className="bg-brand-card rounded-2xl p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Elin</h3>
          <span className="text-purple-400 text-sm">{gameView.myHand.length} kart</span>
        </div>

        {/* Hand cards with enter/exit animation */}
        <div className="flex gap-5 justify-center mb-4 min-h-[7rem] items-end">
          <AnimatePresence mode="popLayout">
            {gameView.myHand.map(card => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 30, scale: 0.8, rotate: -8 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, y: -20, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <PlayingCard
                  card={card}
                  selectable={isMyTurn && gameView.phase === 'play' && !gameView.hasPendingAction}
                  selected={selectedCardId === card.id}
                  onClick={() => {
                    if (isMyTurn && gameView.phase === 'play' && !gameView.hasPendingAction) {
                      setSelectedCardId(prev => prev === card.id ? null : card.id);
                    }
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {gameView.myHand.length === 0 && (
            <p className="text-purple-500 text-sm">Elde kart yok</p>
          )}
        </div>

        {/* Selected card description */}
        <AnimatePresence>
          {selectedCardId && (() => {
            const c = gameView.myHand.find(x => x.id === selectedCardId);
            return c ? (
              <motion.p
                key={selectedCardId}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-center text-purple-300 text-xs mb-3 italic"
              >
                {CARD_DESC[c.value]}
              </motion.p>
            ) : null;
          })()}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          {isMyTurn && gameView.phase === 'draw' && !gameView.hasPendingAction && (
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={handleDrawCard}
              className="btn-primary px-8"
            >
              🎴 Kart Çek
            </motion.button>
          )}
          {isMyTurn && gameView.phase === 'play' && !gameView.hasPendingAction && (
            <motion.button
              whileHover={selectedCardId ? { scale: 1.05 } : {}}
              whileTap={selectedCardId ? { scale: 0.95 } : {}}
              onClick={handlePlayCardClick}
              disabled={!selectedCardId}
              className={`
                px-8 py-3 rounded-xl font-bold transition-all duration-200
                ${selectedCardId
                  ? 'bg-gradient-to-r from-amber-400 to-brand-secondary text-brand-dark shadow-lg shadow-amber-500/30 hover:shadow-[0_0_28px_6px_rgba(245,158,11,0.6)]'
                  : 'bg-brand-card text-purple-500 opacity-60 cursor-not-allowed'}
              `}
            >
              🎯 Kartı Oyna
            </motion.button>
          )}
          {(!isMyTurn || gameView.hasPendingAction) && (
            <div className="flex items-center gap-2 text-purple-500 text-sm py-2">
              <motion.div
                animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-2 h-2 rounded-full bg-purple-500"
              />
              {gameView.hasPendingAction && isMyTurn ? 'Aksiyonunu seç...' : 'Diğer oyuncunun sırası...'}
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-6 py-3 bg-red-900/95 border border-red-500 text-red-200 rounded-xl text-sm shadow-xl z-50"
          >
            ⚠️ {error}
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

      {/* Deck pile — pinned to the right-center edge */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40">
        <DeckPile count={gameView.deckSize} />
      </div>

      {/* In-game chat & quick emojis */}
      <ChatPanel roomCode={roomCode} mySocketId={mySocketId} />
    </div>
  );
}
