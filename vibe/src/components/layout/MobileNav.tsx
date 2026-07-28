import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, PlusCircle, User } from 'lucide-react';
import { cn } from '../../utils/cn';
import { usePlayerStore } from '../../store/usePlayerStore';

const navItems = [
  { to: '/',        icon: Home,        label: 'Home'    },
  { to: '/add',     icon: PlusCircle,  label: 'Add'     },
  { to: '/profile', icon: User,        label: 'Profile' },
];

export const MobileNav = () => {
  const hasPlayer = !!usePlayerStore(s => s.currentSong);

  return (
    <nav className={cn(
      'lg:hidden fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
      hasPlayer ? 'bottom-24' : 'bottom-6',
    )}>
      <div className="flex items-center gap-1 bg-zinc-900/90 border border-white/10 backdrop-blur-2xl rounded-full shadow-2xl shadow-black/60 px-4 py-2.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <div className="relative flex flex-col items-center px-4 py-1">
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-purple-600/20 rounded-full border border-purple-500/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {/* Active dot */}
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400"
                    style={{ boxShadow: '0 0 8px #a855f7' }}
                  />
                )}
                <Icon className={cn(
                  'w-5 h-5 relative z-10 transition-colors duration-200',
                  isActive ? 'text-purple-400' : 'text-slate-500',
                )} />
                <span className={cn(
                  'text-[10px] font-semibold mt-0.5 relative z-10 transition-colors duration-200',
                  isActive ? 'text-purple-400' : 'text-slate-600',
                )}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};