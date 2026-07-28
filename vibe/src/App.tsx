import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout }        from './components/layout/Layout';
import { useAuth }       from './hooks/useAuth';
import { useAuthStore }  from './store/useAuthStore';
import { SplashScreen }  from './components/SplashScreen'; // ✅

// ── Pages ──────────────────────────────────────────────────
import Auth           from './pages/Auth';
import Home           from './pages/Home';
import AddSong        from './pages/AddSong';
import Profile        from './pages/Profile';
import SeeAll         from './pages/SeeAll';
import SearchPage     from './pages/Search';
import Playlists      from './pages/Playlist';
import PlaylistDetail from './pages/PlaylistDetail';

// ── Page transition wrapper ────────────────────────────────
const Page = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.18, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// ── Auth guard ─────────────────────────────────────────────
const Guard = ({ children }: { children: React.ReactNode }) => {
  const user      = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);

  if (isLoading) return <Spinner />;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

// ── Spinner ────────────────────────────────────────────────
const Spinner = () => (
  <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-full border-2 border-white/5" />
      <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  </div>
);

// ── App shell ──────────────────────────────────────────────
const AppShell = () => {
  const location = useLocation();

  return (
    <Layout>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/"                element={<Page><Home /></Page>} />
          <Route path="/search"          element={<Page><SearchPage /></Page>} />
          <Route path="/playlists"       element={<Page><Playlists /></Page>} />
          <Route path="/playlist/:id"    element={<Page><PlaylistDetail /></Page>} />
          <Route path="/add"             element={<Page><AddSong /></Page>} />
          <Route path="/profile"         element={<Page><Profile /></Page>} />
          <Route path="/profile/:userId" element={<Page><Profile /></Page>} />
          <Route path="/see-all/:type"   element={<Page><SeeAll /></Page>} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
};

// ── Root ───────────────────────────────────────────────────
export default function App() {
  useAuth();
  const user      = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);

  // ✅ Splash state — sirf pehli baar dikhao
  const [splashDone, setSplashDone] = useState(false);

  // ✅ Splash pehle — auth load hone ka wait bhi isme ho jaata hai
  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  // Auth still loading ke baad splash complete ho gayi
  if (isLoading) return <Spinner />;

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <Auth />}
      />

      {/* Protected */}
      <Route
        path="/*"
        element={
          <Guard>
            <AppShell />
          </Guard>
        }
      />
    </Routes>
  );
}