import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input  } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';

// ── Copy per tab — keeps the right panel feeling alive on switch ──
const COPY = {
  login: {
    eyebrow: 'WELCOME BACK',
    title:   "Let's get you back in.",
    sub:     'Sign in to pick up right where the playlist left off.',
    cta:     'Sign In',
  },
  register: {
    eyebrow: 'CREATE ACCOUNT',
    title:   'Set up your account.',
    sub:     'Add your first track and start building your library.',
    cta:     'Create Account',
  },
} as const;

const authErrorMessage = (err: unknown, fallback: string): string => {
  const raw = err instanceof Error ? err.message : '';
  return raw.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '').trim() || fallback;
};

// ── Underline tab toggle — no pill, no fill ─────────────────
const TabSwitcher = ({ tab, onChange }: {
  tab: 'login' | 'register';
  onChange: (t: 'login' | 'register') => void;
}) => (
  <div className="flex gap-6 border-b border-white/10">
    {(['login', 'register'] as const).map(t => (
      <button
        key={t}
        type="button"
        onClick={() => onChange(t)}
        className={`relative pb-3 text-sm font-semibold transition-colors duration-150 cursor-pointer ${
          tab === t ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        {t === 'login' ? 'Sign In' : 'Sign Up'}
        {tab === t && (
          <motion.div
            layoutId="auth-tab-underline"
            className="absolute left-0 right-0 -bottom-px h-[2px] bg-indigo-500"
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
        )}
      </button>
    ))}
  </div>
);

export default function Auth() {
  const [tab,      setTab     ] = useState<'login' | 'register'>('login');
  const [name,     setName    ] = useState('');
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError   ] = useState('');
  const [loading,  setLoading ] = useState(false);

  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const copy = COPY[tab];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (tab === 'login') await loginWithEmail(email, password);
      else                 await registerWithEmail(email, password, name);
      navigate('/');
    } catch (err) {
      setError(authErrorMessage(err, 'Something went wrong'));
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try   { await loginWithGoogle(); navigate('/'); }
    catch (err) { setError(authErrorMessage(err, 'Google sign-in failed')); }
    finally { setLoading(false); }
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto lg:overflow-hidden bg-[#0a0a0c] flex flex-col lg:flex-row">

      {/* ══════════════════ Left — brand stage (desktop only) ══════════════════ */}
      <div
        className="hidden lg:flex lg:w-[48%] xl:w-[44%] relative flex-col justify-between p-14 overflow-hidden border-r border-white/10"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), ' +
            'linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      >
        {/* Brand row */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Music2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold text-base text-white tracking-tight">Zuno</span>
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-md">
          <h1 className="font-display font-semibold text-4xl xl:text-[2.75rem] leading-[1.12] tracking-tight text-white">
            Your next favorite song is one tap away.
          </h1>
          <p className="mt-4 text-zinc-500 text-[15px] leading-relaxed">
            Every song, every playlist — streamed without a single ad.
          </p>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Why Zuno</p>
            <p className="mt-3 text-zinc-200 text-xl font-display font-semibold leading-snug">
              No ads. No interruptions.<br />Just the music.
            </p>
          </div>
        </div>

        {/* Footer — minimal equalizer signal */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600 font-medium tracking-widest uppercase">Zuno / 2026</span>
          <div className="flex items-end gap-[3px]">
            {[8, 13, 10, 16, 11].map((h, i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-sm bg-indigo-500/70"
                animate={{ height: [h, h + 6, h - 2, h + 4, h] }}
                transition={{ repeat: Infinity, duration: 1 + i * 0.06, delay: i * 0.08, ease: 'easeInOut' }}
                initial={{ height: h }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ Right — auth form ══════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">

          {/* Compact brand mark — mobile only */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Music2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-base text-white tracking-tight">Zuno</span>
          </div>

          {/* Contextual heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mb-7"
            >
              <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
                {copy.eyebrow}
              </span>
              <h2 className="font-display font-semibold text-2xl text-white tracking-tight mt-1.5">
                {copy.title}
              </h2>
              <p className="text-zinc-500 text-sm mt-2">{copy.sub}</p>
            </motion.div>
          </AnimatePresence>

          <TabSwitcher tab={tab} onChange={t => { setTab(t); setError(''); }} />

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <AnimatePresence>
              {tab === 'register' && (
                <motion.div key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}>
                  <Input label="Display Name" placeholder="Your name" value={name}
                    onChange={e => setName(e.target.value)}
                    className="rounded-lg h-11"
                    leftIcon={<User className="w-4 h-4" />} required />
                </motion.div>
              )}
            </AnimatePresence>

            <Input label="Email" type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-lg h-11"
              leftIcon={<Mail className="w-4 h-4" />} required />

            <Input label="Password" type={showPass ? 'text' : 'password'}
              placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-lg h-11"
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button type="button" onClick={() => setShowPass(!showPass)} className="cursor-pointer">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              } required />

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full rounded-xl bg-none bg-indigo-600 hover:bg-indigo-500 shadow-none"
              size="lg" isLoading={loading}>
              {copy.cta}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-600">or continue with</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <Button variant="glass" className="w-full rounded-xl" size="lg"
            onClick={handleGoogle} isLoading={loading}
            leftIcon={
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            }>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
