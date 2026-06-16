import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useSocket } from '../hooks/useSocket';
import { socket } from '../socket';
import { playClick, startBGM } from '../audio';
import { HowToPlay } from '../components/HowToPlay';
import { AuthModal } from '../components/AuthModal';
import { useAuth, logout, refreshMe } from '../auth';
import type { GameState } from '../types';

type Step = 'name' | 'action' | 'join';

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuth();
  const [step, setStep] = useState<Step>('name');
  const [username, setUsername] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Effective player name: account name when logged in, else the typed guest name.
  const playerName = (user?.username ?? username).trim();

  // Pull fresh stats on load (e.g. after returning from a finished game).
  useEffect(() => { void refreshMe(); }, []);

  // Logged-in users skip the name-entry step.
  useEffect(() => { if (user && step === 'name') setStep('action'); }, [user, step]);

  const handleRoomJoined = useCallback(
    ({ roomCode, state }: { roomCode: string; state: GameState }) => {
      setLoading(false);
      navigate(`/lobby/${roomCode}`, { state: { gameState: state, username: playerName } });
    },
    [navigate, playerName]
  );

  const handleJoinError = useCallback(({ message }: { message: string }) => {
    setError(message);
    setLoading(false);
  }, []);

  useSocket({ onRoomJoined: handleRoomJoined, onJoinError: handleJoinError });

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    playClick();
    setStep('action');
  }

  function handleCreateRoom() {
    playClick();
    startBGM();
    setError('');
    setLoading(true);
    if (!socket.connected) socket.connect();
    socket.emit('join_room', { username: playerName });
  }

  function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    playClick();
    startBGM();
    setError('');
    setLoading(true);
    if (!socket.connected) socket.connect();
    socket.emit('join_room', { username: playerName, roomCode: roomCodeInput.trim() });
  }

  function handleLogout() {
    playClick();
    logout();
    setUsername('');
    setStep('name');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md w-full">

        {/* Account bar */}
        <div className="flex justify-center mb-5">
          {user ? (
            <div className="flex items-center gap-3 bg-brand-card border border-purple-700 rounded-full pl-4 pr-2 py-1.5">
              <span className="text-sm text-white font-medium">👤 {user.username}</span>
              <span className="text-xs text-purple-400">🏆 {user.wins} · 🎮 {user.totalGames}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-purple-400 hover:text-white border border-purple-700 hover:border-purple-400 rounded-full px-2.5 py-0.5 transition-colors"
              >
                Çıkış
              </button>
            </div>
          ) : (
            <button
              onClick={() => { playClick(); setShowAuth(true); }}
              className="text-sm text-purple-300 hover:text-brand-secondary border border-purple-700 hover:border-brand-secondary rounded-full px-4 py-1.5 transition-colors"
            >
              👤 Giriş Yap / Kayıt Ol
            </button>
          )}
        </div>

        <div className="mb-2 text-6xl">🐾</div>
        <h1 className="text-5xl font-bold text-brand-secondary font-game">Power Hungry</h1>
        <h2 className="text-5xl font-bold text-white mb-8 font-game">Pets</h2>

        {step === 'name' && !user && (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <p className="text-purple-300 text-lg mb-6">Misafir olarak oyna — adını gir</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Kullanıcı adın..."
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-brand-card border border-purple-600 text-white placeholder-purple-400 focus:outline-none focus:border-brand-primary text-lg text-center"
            />
            <button
              type="submit"
              disabled={!username.trim()}
              className="btn-primary w-full text-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Devam Et →
            </button>
          </form>
        )}

        {step === 'action' && (
          <div className="space-y-4">
            <p className="text-purple-300 mb-6">
              Hoş geldin, <span className="text-brand-secondary font-bold">{playerName}</span>!
            </p>
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="btn-primary w-full text-lg disabled:opacity-50"
            >
              {loading ? 'Oda kuruluyor...' : '🏠 Yeni Oda Kur'}
            </button>
            <button
              onClick={() => { playClick(); setStep('join'); }}
              disabled={loading}
              className="btn-secondary w-full text-lg disabled:opacity-50"
            >
              🔑 Oda Koduyla Katıl
            </button>
            {!user && (
              <button
                onClick={() => { playClick(); setStep('name'); }}
                className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                ← Adı değiştir
              </button>
            )}
          </div>
        )}

        {step === 'join' && (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <p className="text-purple-300 mb-6">Oda kodunu gir</p>
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="XXXX"
              maxLength={4}
              autoFocus
              className="w-full px-4 py-4 rounded-xl bg-brand-card border border-purple-600 text-white placeholder-purple-400 focus:outline-none focus:border-brand-primary text-3xl text-center tracking-[0.5em] font-mono uppercase"
            />
            <button
              type="submit"
              disabled={roomCodeInput.trim().length !== 4 || loading}
              className="btn-primary w-full text-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Katılınıyor...' : 'Odaya Katıl'}
            </button>
            <button
              type="button"
              onClick={() => { playClick(); setStep('action'); setError(''); }}
              className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              ← Geri
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-500 text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={() => { playClick(); setShowHowTo(true); }}
          className="mt-8 text-purple-400 hover:text-brand-secondary text-sm inline-flex items-center gap-1.5 transition-colors"
        >
          <span>📖</span> Nasıl Oynanır?
        </button>
      </div>

      <AnimatePresence>
        {showHowTo && (
          <HowToPlay onClose={() => { playClick(); setShowHowTo(false); }} />
        )}
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onSuccess={(u) => { setShowAuth(false); setUsername(u.username); setStep('action'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
