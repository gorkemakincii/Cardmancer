import { useState, useCallback, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { socket } from '../socket';
import { playClick } from '../audio';
import { ChatPanel } from '../components/ChatPanel';
import type { GameState, Player, PlayerGameView } from '../types';

// ── Inline icons ────────────────────────────────────────────────────────────────

function PawMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <ellipse cx="6.5" cy="9" rx="2" ry="2.6" />
      <ellipse cx="11" cy="6.6" rx="2" ry="2.7" />
      <ellipse cx="15.8" cy="7.2" rx="2" ry="2.6" />
      <ellipse cx="19" cy="11.2" rx="1.8" ry="2.3" />
      <path d="M12.3 11.4c2.7 0 5 1.8 5.4 4.3.3 2-1.2 3.6-3.2 3.6-.9 0-1.5-.3-2.2-.3s-1.3.3-2.2.3c-2 0-3.5-1.6-3.2-3.6.4-2.5 2.7-4.3 5.4-4.3Z" />
    </svg>
  );
}
function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M3 7.5 7 11l5-6 5 6 4-3.5-1.8 11H4.8L3 7.5Z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L20 6" />
    </svg>
  );
}

export default function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as { gameState: GameState; username: string } | null;
  const [gameState, setGameState] = useState<GameState | null>(locationState?.gameState ?? null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!locationState) {
      navigate('/');
    }
  }, [locationState, navigate]);

  const handleRoomStateUpdated = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  const handleGameStarted = useCallback((view: PlayerGameView) => {
    setStarting(false);
    navigate(`/game/${view.roomCode}`, { state: { gameView: view } });
  }, [navigate]);

  useSocket({
    onRoomStateUpdated: handleRoomStateUpdated,
    onGameStarted: handleGameStarted,
  });

  if (!gameState || !roomCode) return null;

  const mySocketId = socket.id;
  const isHost = gameState.hostId === mySocketId;
  const canStart = gameState.players.length >= 2;

  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStartGame() {
    playClick();
    setStarting(true);
    socket.emit('start_game', { roomCode });
  }

  return (
    <div className="arcade-stage min-h-screen flex flex-col items-center justify-center px-4 py-10 font-ui text-arcade-cream">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-arcade-sun border-[3px] border-arcade-ink shadow-hard-sm mb-3 -rotate-3">
            <PawMark className="w-7 h-7 text-arcade-ink" />
          </div>
          <h2 className="font-display font-extrabold text-3xl text-arcade-cream">Oyun lobisi</h2>
          <p className="text-sm font-medium text-arcade-cream/60 mt-1">
            {gameState.status === 'WAITING' ? 'Oyuncular bekleniyor…' : 'Oyun başlıyor!'}
          </p>
        </div>

        {/* Room code */}
        <div className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] shadow-hard p-6 mb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-60 mb-2">Oda kodu</p>
          <div className="title-arcade text-arcade-coral text-6xl tracking-[0.12em] mb-4">
            {roomCode}
          </div>
          <button
            onClick={() => { playClick(); copyRoomCode(); }}
            className="inline-flex items-center gap-2 text-sm font-bold bg-arcade-ink text-arcade-cream rounded-xl px-4 py-2 hover:bg-arcade-coral hover:text-arcade-ink transition-colors"
          >
            {copied ? <><CheckIcon /> Kopyalandı</> : <><CopyIcon /> Kodu kopyala</>}
          </button>
          <p className="text-xs font-medium opacity-60 mt-3">
            Arkadaşlarınla bu kodu paylaş — {gameState.maxPlayers} oyuncuya kadar
          </p>
        </div>

        {/* Player list */}
        <div className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] shadow-hard p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-extrabold text-lg">Oyuncular</h3>
            <span className="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-full bg-arcade-sun border-2 border-arcade-ink">
              {gameState.players.length} / {gameState.maxPlayers}
            </span>
          </div>

          <div className="space-y-2">
            {gameState.players.map((player: Player) => {
              const me = player.socketId === mySocketId;
              return (
                <div
                  key={player.socketId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 ${
                    me ? 'bg-arcade-sun/30 border-arcade-ink' : 'bg-white/55 border-arcade-ink/15'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-arcade-ink text-arcade-cream flex items-center justify-center text-sm font-display font-bold shrink-0">
                    {player.username[0].toUpperCase()}
                  </div>
                  <span className="font-semibold flex-1 min-w-0 truncate">
                    {player.username}
                    {me && <span className="opacity-50 text-xs ml-2">(Sen)</span>}
                  </span>
                  {player.isHost && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-arcade-ink bg-arcade-sun border-2 border-arcade-ink rounded-full px-2 py-0.5 shrink-0" title="Host">
                      <CrownIcon /> Host
                    </span>
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: gameState.maxPlayers - gameState.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed border-arcade-ink/25"
              >
                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-arcade-ink/25 shrink-0" />
                <span className="text-sm font-medium opacity-40">Bekleniyor…</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {isHost ? (
          <div className="space-y-3">
            <button
              onClick={handleStartGame}
              disabled={!canStart || starting || gameState.status !== 'WAITING'}
              className="btn-arcade w-full py-3.5 text-lg"
            >
              {starting ? 'Başlatılıyor…' : 'Oyunu başlat'}
            </button>
            {!canStart && (
              <p className="text-center text-sm font-medium text-arcade-cream/60">
                Başlatmak için en az 2 oyuncu gerekli
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-3">
            <div className="inline-flex items-center gap-2 text-arcade-cream/60">
              <span className="w-2.5 h-2.5 rounded-full bg-arcade-coral animate-pulse" />
              <span className="text-sm font-medium">Host oyunu başlatana kadar bekleniyor…</span>
            </div>
          </div>
        )}

        <button
          onClick={() => { playClick(); socket.disconnect(); navigate('/'); }}
          className="block mx-auto mt-4 text-sm font-semibold text-arcade-cream/50 hover:text-arcade-cream underline decoration-2 underline-offset-2 transition-colors py-2"
        >
          ← Lobiden ayrıl
        </button>
      </div>

      {/* Lobby chat & quick emojis */}
      <ChatPanel roomCode={roomCode} mySocketId={mySocketId ?? ''} />
    </div>
  );
}
