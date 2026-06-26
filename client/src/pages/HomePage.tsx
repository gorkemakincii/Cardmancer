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

// ── Inline icons (no emoji — keeps the neo-arcade look deliberate) ──────────────

const ico = 'shrink-0';

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
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={ico} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={ico} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="4" />
      <path d="m10.8 10.8 7.2 7.2M16 16l2-2M19 13l1.5 1.5" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={ico} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v16H5.5A2.5 2.5 0 0 0 3 21.5ZM21 5.5A2.5 2.5 0 0 0 18.5 3H12v16h6.5a2.5 2.5 0 0 1 2.5 2.5Z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className={ico} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" className={ico} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

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
    <div className="arcade-stage min-h-screen flex flex-col items-center justify-center px-4 py-10 font-ui text-arcade-cream">
      <div className="w-full max-w-md">

        {/* Account bar */}
        <div className="flex justify-center mb-7">
          {user ? (
            <div className="flex items-center gap-3 bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-full pl-3.5 pr-2 py-1.5 shadow-hard-sm">
              <span className="flex items-center gap-1.5 text-sm font-bold"><UserIcon /> {user.username}</span>
              <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-arcade-sun border-2 border-arcade-ink">
                {user.wins}G · {user.totalGames}O
              </span>
              <button
                onClick={handleLogout}
                className="text-xs font-bold uppercase tracking-wide bg-arcade-ink text-arcade-cream rounded-full px-2.5 py-1 hover:bg-arcade-coral hover:text-arcade-ink transition-colors"
              >
                Çıkış
              </button>
            </div>
          ) : (
            <button
              onClick={() => { playClick(); setShowAuth(true); }}
              className="btn-ghost-arcade inline-flex items-center gap-2 text-sm px-4 py-1.5"
            >
              <UserIcon /> Giriş yap / Kayıt ol
            </button>
          )}
        </div>

        {/* Hero */}
        <div className="text-center mb-9">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-arcade-sun border-[3px] border-arcade-ink shadow-hard mb-5 -rotate-3">
            <PawMark className="w-9 h-9 text-arcade-ink" />
          </div>
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.35em] text-arcade-sun mb-2">
            Gerçek zamanlı kart oyunu
          </p>
          <h1 className="title-arcade text-arcade-cream text-6xl sm:text-7xl">CARD</h1>
          <h1 className="title-arcade text-arcade-coral text-6xl sm:text-7xl mt-1">MANCER</h1>
        </div>

        {/* Card panel — the interactive flow lives on a cream "sticker" */}
        <div className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] shadow-hard p-6 sm:p-7">

          {step === 'name' && !user && (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <label htmlFor="guest-name" className="block font-display font-extrabold text-xl">
                Misafir olarak oyna
              </label>
              <p className="text-sm font-medium opacity-70 -mt-2">Bir takma ad seç, hesap gerekmez.</p>
              <input
                id="guest-name"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Takma adın…"
                maxLength={20}
                autoFocus
                className="input-arcade w-full px-4 py-3 text-lg text-center font-semibold"
              />
              <button
                type="submit"
                disabled={!username.trim()}
                className="btn-arcade w-full py-3.5 text-lg"
              >
                Devam et <ArrowIcon />
              </button>
            </form>
          )}

          {step === 'action' && (
            <div className="space-y-4">
              <p className="font-display font-extrabold text-xl">
                Hazırsın, <span className="text-arcade-coral">{playerName}</span>
              </p>
              <p className="text-sm font-medium opacity-70 -mt-2">Yeni bir masa kur ya da kodla bir masaya otur.</p>
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="btn-arcade w-full py-3.5 text-lg"
              >
                <PlusIcon /> {loading ? 'Oda kuruluyor…' : 'Oda kur'}
              </button>
              <button
                onClick={() => { playClick(); setStep('join'); }}
                disabled={loading}
                className="btn-arcade btn-arcade--teal w-full py-3.5 text-lg"
              >
                <KeyIcon /> Oda koduyla katıl
              </button>
              {!user && (
                <button
                  onClick={() => { playClick(); setStep('name'); }}
                  className="block mx-auto text-sm font-semibold underline decoration-2 underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
                >
                  ← Adı değiştir
                </button>
              )}
            </div>
          )}

          {step === 'join' && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <label htmlFor="room-code" className="block font-display font-extrabold text-xl">
                Oda kodunu gir
              </label>
              <p className="text-sm font-medium opacity-70 -mt-2">Masayı kuran kişiden 4 haneli kodu al.</p>
              <input
                id="room-code"
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="XXXX"
                maxLength={4}
                autoFocus
                className="input-arcade w-full px-4 py-4 text-4xl text-center tracking-[0.4em] font-bold uppercase"
              />
              <button
                type="submit"
                disabled={roomCodeInput.trim().length !== 4 || loading}
                className="btn-arcade w-full py-3.5 text-lg"
              >
                {loading ? 'Katılınıyor…' : 'Masaya otur'}
              </button>
              <button
                type="button"
                onClick={() => { playClick(); setStep('action'); setError(''); }}
                className="block mx-auto text-sm font-semibold underline decoration-2 underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                ← Geri
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-arcade-coral/25 border-[3px] border-arcade-ink text-arcade-ink text-sm font-semibold">
              {error}
            </div>
          )}
        </div>

        {/* How to play */}
        <div className="flex justify-center mt-7">
          <button
            onClick={() => { playClick(); setShowHowTo(true); }}
            className="btn-ghost-arcade inline-flex items-center gap-2 text-sm px-4 py-2"
          >
            <BookIcon /> Nasıl oynanır?
          </button>
        </div>
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
