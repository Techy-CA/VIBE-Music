import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Search, PlusCircle, User, Music2, Menu, X, ListMusic } from 'lucide-react';
import { BottomPlayer }   from '../player/BottomPlayer';
import { QueuePanel }     from '../player/QueuePanel';
import { PlayerEngine }   from '../player/PlayerEngine';
import { MobileBar }      from '../player/MobileBar';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAuthStore }   from '../../store/useAuthStore';
import { useAdmin }       from '../../hooks/useAdmin';
import { cn }             from '../../utils/cn';

const BASE_NAV = [
  { to: '/',          icon: Home,       label: 'Home'      },
  { to: '/search',    icon: Search,     label: 'Search'    },
  { to: '/playlists', icon: ListMusic,  label: 'Playlists' },
  { to: '/profile',   icon: User,       label: 'Profile'   },
];

const ADD_NAV_ITEM = { to: '/add', icon: PlusCircle, label: 'Add' };

const BOTTOM_NAV_H = 60;
const MOBILE_BAR_H = 63;
const TIMELINE_H   = 3;

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const currentSong = usePlayerStore(s => s.currentSong);
  const user        = useAuthStore(s => s.user);
  const { isAdmin }  = useAdmin();
  const [mobileMenu, setMobileMenu] = useState(false);

  const NAV = isAdmin
    ? [...BASE_NAV.slice(0, 3), ADD_NAV_ITEM, ...BASE_NAV.slice(3)]
    : BASE_NAV;

  const hasPlayer  = !!currentSong;
  const mobilePadB = hasPlayer
    ? BOTTOM_NAV_H + MOBILE_BAR_H + TIMELINE_H + 8
    : BOTTOM_NAV_H + 8;

  return (
    // ✅ h-dvh — handles mobile browser address bar correctly
    <div className="flex bg-[#0d0d0d]" style={{ height: '100dvh', width: '100vw', overflow: 'hidden' }}>

      <PlayerEngine />

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-white/[0.06] bg-[#0a0a0a] h-full">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Music2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">Zuno</span>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
                isActive ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/4',
              )}>
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-violet-400')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="px-4 py-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-violet-600/80 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-[12px] font-medium text-zinc-400 truncate">{user.name}</p>
            </div>
          </div>
        )}
      </aside>

      {/* ── Mobile Drawer Backdrop ── */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileMenu(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Mobile Drawer Sidebar ── */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.aside
            key="drawer-sidebar"
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed left-0 top-0 bottom-0 w-[240px] bg-[#0a0a0a] border-r border-white/[0.07] z-[90] flex flex-col lg:hidden"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                  <Music2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-[15px] font-bold text-white">Zuno</span>
              </div>
              <button onClick={() => setMobileMenu(false)}
                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
              {NAV.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  onClick={() => setMobileMenu(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium transition-all',
                    isActive ? 'bg-white/8 text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/4',
                  )}>
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-violet-400')} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            {user && (
              <div className="px-4 py-4 border-t border-white/[0.05]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-violet-600/80 flex items-center justify-center text-white text-[12px] font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[12px] font-medium text-zinc-400 truncate">{user.name}</p>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      {/* ✅ min-h-0 is CRITICAL — prevents flex child from overflowing on mobile */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-[#0d0d0d] flex-shrink-0">
          <button onClick={() => setMobileMenu(true)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400">
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center">
              <Music2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-[14px] font-bold text-white">Zuno</span>
          </div>
          <NavLink to="/search"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            <Search className="w-4 h-4" />
          </NavLink>
        </div>

        {/* ✅ Scrollable content — min-h-0 + WebkitOverflowScrolling for iOS */}
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden lg:pb-[88px]"
          style={{
            paddingBottom: mobilePadB,
            WebkitOverflowScrolling: 'touch', // ← iOS momentum scroll
          }}
        >
          <div className="w-full max-w-[900px] mx-auto px-4 sm:px-5 lg:px-6 py-5 lg:py-6">
            {children}
          </div>
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/[0.07]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="grid py-1.5" style={{ gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}>
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={({ isActive }) => cn(
                  'flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all',
                  isActive ? 'text-white' : 'text-zinc-600',
                )}>
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-5 h-5', isActive && 'text-violet-400')} />
                    <span className={cn('text-[9px] font-medium', isActive ? 'text-zinc-300' : 'text-zinc-600')}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <MobileBar />
      <BottomPlayer />
      <QueuePanel />
    </div>
  );
};