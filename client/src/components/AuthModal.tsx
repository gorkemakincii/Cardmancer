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

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-brand-dark border border-purple-700 text-white placeholder-purple-500 focus:outline-none focus:border-brand-primary text-sm';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-brand-card border border-purple-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
      >
        {/* Tabs */}
        <div className="flex border-b border-purple-700">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                mode === m ? 'text-white bg-brand-primary/30 border-b-2 border-brand-primary' : 'text-purple-400 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
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
            <div className="px-3 py-2 rounded-lg bg-red-900/40 border border-red-500 text-red-300 text-xs">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Lütfen bekle...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </button>

          <button
            type="button"
            onClick={() => { playClick(); onClose(); }}
            className="w-full text-purple-400 hover:text-white text-sm py-1 transition-colors"
          >
            Misafir olarak devam et
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
