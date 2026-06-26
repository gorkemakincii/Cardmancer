import { useState } from 'react';
import { motion } from 'framer-motion';
import { login, register, type AuthUser } from '../auth';
import { playClick } from '../audio';

type Mode = 'login' | 'register';

export function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    playClick();
    setMode(next);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = mode === 'login'
        ? await login({ identifier: identifier.trim(), password })
        : await register({ username: username.trim(), email: email.trim(), password });
      playClick();
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'input-arcade w-full px-4 py-2.5 text-sm font-semibold';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-arcade-ink/85 backdrop-blur-sm flex items-center justify-center z-50 px-4 font-ui"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-arcade-cream text-arcade-ink border-[3px] border-arcade-ink rounded-[22px] w-full max-w-sm shadow-hard overflow-hidden"
      >
        {/* Segmented tabs */}
        <div className="flex gap-2 p-3 border-b-[3px] border-arcade-ink">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 rounded-xl font-display font-extrabold text-sm border-[3px] border-arcade-ink transition-all ${
                mode === m
                  ? 'bg-arcade-coral text-arcade-ink shadow-hard-sm'
                  : 'bg-transparent text-arcade-ink/55 hover:text-arcade-ink'
              }`}
            >
              {m === 'login' ? 'Giriş yap' : 'Kayıt ol'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {mode === 'login' ? (
            <>
              <input
                className={inputCls}
                placeholder="Kullanıcı adı veya e-posta"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoFocus
              />
              <input
                className={inputCls}
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          ) : (
            <>
              <input
                className={inputCls}
                placeholder="Kullanıcı adı (3-20 karakter)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                autoFocus
              />
              <input
                className={inputCls}
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className={inputCls}
                type="password"
                placeholder="Şifre (en az 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}

          {error && (
            <div className="px-3 py-2 rounded-xl bg-arcade-coral/25 border-[3px] border-arcade-ink text-arcade-ink text-xs font-semibold">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-arcade w-full py-3">
            {loading ? 'Lütfen bekle…' : mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
          </button>

          <button
            type="button"
            onClick={() => { playClick(); onClose(); }}
            className="block mx-auto text-sm font-semibold underline decoration-2 underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            Misafir olarak devam et
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
