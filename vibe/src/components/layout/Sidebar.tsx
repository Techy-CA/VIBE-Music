import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, PlusCircle, User, LogOut, ListMusic, Plus, X, Music2 } from 'lucide-react';
import { cn }          from '../../utils/cn';
import { Avatar }      from '../ui/Avatar';
import { useAuth }     from '../../hooks/useAuth';
import { usePlaylist } from '../../hooks/usePlaylist';

const NavItem = ({ to, icon: Icon, label }: {
  to: string; icon: React.ElementType; label: string;
}) => (
  <NavLink to={to} end={to === '/'}>
    {({ isActive }) => (
      <div className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer group',
        isActive ? 'text-white bg-white/6' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]',
      )}>
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-violet-500" />
        )}
        <Icon className={cn(
          'w-[18px] h-[18px] flex-shrink-0 transition-colors duration-150',
          isActive ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400',
        )} strokeWidth={isActive ? 2 : 1.75} />
        <span>{label}</span>
      </div>
    )}
  </NavLink>
);

const PlaylistRow = ({ playlist }: { playlist: any }) => (
  <NavLink to={`/playlist/${playlist.id}`}>
    {({ isActive }) => (
      <div className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group',
        isActive ? 'bg-white/6 text-white' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300',
      )}>
        <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
          {playlist.coverThumbnail ? (
            <img src={playlist.coverThumbnail} alt={playlist.name}
              className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 className="w-3.5 h-3.5 text-zinc-600" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[12.5px] font-medium truncate',
            isActive ? 'text-white' : 'text-zinc-300 group-hover:text-white',
          )}>
            {playlist.name}
          </p>
          <p className="text-[11px] text-zinc-600">
            {playlist.songIds?.length ?? 0} songs
          </p>
        </div>
      </div>
    )}
  </NavLink>
);

export const Sidebar = () => {
  const { user, signOutUser }    = useAuth();
  const { playlists, createNew } = usePlaylist();
  const [creating, setCreating]  = useState(false);
  const [newName,  setNewName]   = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createNew(newName);
    setNewName('');
    setCreating(false);
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[240px] bg-[#0c0c0c] border-r border-white/[0.06] z-40">

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
          <Music2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-semibold text-white tracking-tight">Zuno</span>
      </div>

      {/* Nav */}
      <nav className="px-2 pb-3 space-y-0.5 border-b border-white/[0.05]">
        <NavItem to="/"        icon={Home}       label="Home"     />
        <NavItem to="/add"     icon={PlusCircle} label="Add Song" />
        <NavItem to="/profile" icon={User}        label="Profile"  />
      </nav>

      {/* Playlists */}
      <div className="flex-1 overflow-hidden flex flex-col px-2 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10.5px] font-semibold text-zinc-600 uppercase tracking-[0.1em]">
            Playlists
          </span>
          <button
            onClick={() => setCreating(!creating)}
            className={cn(
              'w-5 h-5 rounded flex items-center justify-center transition-all duration-150',
              creating ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/5',
            )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={creating ? 'x' : 'plus'}
                initial={{ opacity: 0, rotate: -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 45 }}
                transition={{ duration: 0.12 }}
              >
                {creating ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </div>

        {/* Create input */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden mb-2"
            >
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Playlist name..."
                  className="flex-1 min-w-0 h-8 bg-white/5 border border-white/8 rounded-lg px-2.5 text-[12px] text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/15 transition-colors"
                />
                <button
                  onClick={handleCreate}
                  className="h-8 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium transition-colors flex-shrink-0"
                >
                  Add
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ✅ PLAYLIST LIST — YEH MISSING THA! */}
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-0.5">
          {playlists.length === 0 ? (
            <div className="px-1 pt-4">
              <div className="rounded-xl border border-dashed border-white/[0.07] p-4 text-center">
                <ListMusic className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                <p className="text-[12px] text-zinc-600 font-medium">No playlists yet</p>
                <p className="text-[11px] text-zinc-700 mt-0.5">Hit + to create one</p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {playlists.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                >
                  <PlaylistRow playlist={pl} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* User */}
      {user && (
        <div className="px-2 py-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group hover:bg-white/[0.03] transition-colors duration-150 cursor-default">
            <div className="relative flex-shrink-0">
              <Avatar src={user.photoURL} name={user.name} size="xs" />
              <div className="absolute -bottom-px -right-px w-2 h-2 bg-emerald-500 rounded-full ring-[1.5px] ring-[#0c0c0c]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-zinc-200 truncate leading-tight">{user.name}</p>
              <p className="text-[10.5px] text-zinc-600 truncate">{user.email}</p>
            </div>
            <button
              onClick={async () => { await signOutUser(); navigate('/auth'); }}
              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};