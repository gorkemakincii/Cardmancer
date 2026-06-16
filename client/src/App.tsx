import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useGameAudio } from './hooks/useGameAudio';
import { socket } from './socket';
import { getActiveRoom, setActiveRoom, clearActiveRoom } from './session';
import type { PlayerGameView } from './types';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

// Re-attaches a dropped/refreshed player to their held seat.
function useSessionResume() {
  const navigate = useNavigate();
  useEffect(() => {
    function attemptRejoin() {
      const room = getActiveRoom();
      if (room) socket.emit('rejoin_room', { roomCode: room });
    }
    function onRejoinSuccess({ gameView }: { gameView: PlayerGameView }) {
      setActiveRoom(gameView.roomCode);
      navigate(`/game/${gameView.roomCode}`, { state: { gameView } });
    }
    function onRejoinFailed() {
      clearActiveRoom();
      if (window.location.pathname.startsWith('/game/')) {
        toast.error('Oyuna geri dönülemedi (oyun bitmiş ya da koltuk kapanmış olabilir).');
        navigate('/');
      }
    }

    socket.on('connect', attemptRejoin);
    socket.on('rejoin_success', onRejoinSuccess);
    socket.on('rejoin_failed', onRejoinFailed);

    // On first load with an active game, make sure we connect and try to rejoin.
    if (getActiveRoom()) {
      if (!socket.connected) socket.connect();
      else attemptRejoin();
    }

    return () => {
      socket.off('connect', attemptRejoin);
      socket.off('rejoin_success', onRejoinSuccess);
      socket.off('rejoin_failed', onRejoinFailed);
    };
  }, [navigate]);
}

export default function App() {
  const { muted, toggleMute } = useGameAudio();
  useSessionResume();

  return (
    <>
      <Toaster position="top-right" richColors theme="dark" />

      {/* Global mute toggle — fixed bottom-right corner */}
      <button
        onClick={toggleMute}
        title={muted ? 'Sesi Aç' : 'Sesi Kapat'}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-brand-card border border-purple-700 hover:border-purple-400 hover:bg-purple-900/50 flex items-center justify-center text-lg shadow-lg transition-all select-none"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:roomCode" element={<LobbyPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
      </Routes>
    </>
  );
}
