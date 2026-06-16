import { useState, useCallback, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { socket } from '../socket';
import { playClick } from '../audio';
import { ChatPanel } from '../components/ChatPanel';
import type { GameState, Player, PlayerGameView } from '../types';

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🐾</div>
          <h2 className="text-2xl font-bold text-white font-game">Oyun Lobisi</h2>
          <p className="text-purple-400 text-sm mt-1">
            {gameState.status === 'WAITING' ? 'Oyuncular bekleniyor...' : 'Oyun başlıyor!'}
          </p>
        </div>

        {/* Room Code Card */}
        <div className="bg-brand-card border border-purple-700 rounded-2xl p-6 mb-6 text-center">
          <p className="text-purple-400 text-sm mb-2 uppercase tracking-widest">Oda Kodu</p>
          <div className="text-6xl font-mono font-bold text-brand-secondary tracking-[0.15em] mb-4">
            {roomCode}
          </div>
          <button
            onClick={() => { playClick(); copyRoomCode(); }}
            className="text-sm text-purple-400 hover:text-white border border-purple-600 hover:border-purple-400 px-4 py-1.5 rounded-lg transition-all"
          >
            {copied ? '✓ Kopyalandı!' : '📋 Kodu Kopyala'}
          </button>
          <p className="text-purple-500 text-xs mt-3">
            Arkadaşlarınla bu kodu paylaş — {gameState.maxPlayers} oyuncuya kadar katılabilir
          </p>
        </div>

        {/* Player List */}
        <div className="bg-brand-card border border-purple-700 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">
              Oyuncular
            </h3>
            <span className="text-purple-400 text-sm">
              {gameState.players.length} / {gameState.maxPlayers}
            </span>
          </div>

          <div className="space-y-2">
            {gameState.players.map((player: Player) => (
              <div
                key={player.socketId}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  player.socketId === mySocketId
                    ? 'bg-purple-800/40 border border-purple-600'
                    : 'bg-purple-900/20'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-bold">
                  {player.username[0].toUpperCase()}
                </div>
                <span className="text-white font-medium flex-1">
                  {player.username}
                  {player.socketId === mySocketId && (
                    <span className="text-purple-400 text-xs ml-2">(Sen)</span>
                  )}
                </span>
                {player.isHost && (
                  <span className="text-brand-secondary text-lg" title="Host">👑</span>
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: gameState.maxPlayers - gameState.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-900/10 border border-dashed border-purple-800"
              >
                <div className="w-8 h-8 rounded-full bg-purple-900 border-2 border-dashed border-purple-700" />
                <span className="text-purple-600 text-sm">Bekleniyor...</span>
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
              className="btn-primary w-full text-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {starting ? 'Başlatılıyor...' : '🎮 Oyunu Başlat'}
            </button>
            {!canStart && (
              <p className="text-center text-purple-400 text-sm">
                Oyunu başlatmak için en az 2 oyuncu gerekli
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-3">
            <div className="inline-flex items-center gap-2 text-purple-400">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-sm">Host oyunu başlatana kadar bekleniyor...</span>
            </div>
          </div>
        )}

        <button
          onClick={() => { playClick(); socket.disconnect(); navigate('/'); }}
          className="w-full mt-4 text-purple-500 hover:text-purple-300 text-sm transition-colors py-2"
        >
          ← Lobiden Ayrıl
        </button>
      </div>

      {/* Lobby chat & quick emojis */}
      <ChatPanel roomCode={roomCode} mySocketId={mySocketId ?? ''} />
    </div>
  );
}
