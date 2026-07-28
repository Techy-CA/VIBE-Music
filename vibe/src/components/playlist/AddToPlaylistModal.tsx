import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check, ListMusic, Loader2 } from 'lucide-react';
import { usePlaylists } from '../../hooks/usePlaylist';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { useAuthStore } from '../../store/useAuthStore';
import type { Song } from '../../types';

interface Props { song: Song | null; onClose: () => void; }

export const AddToPlaylistModal = ({ song, onClose }: Props) => {
  const { playlists, addSongToPlaylist } = usePlaylists();
  const user = useAuthStore(s => s.user);
  const [added,      setAdded     ] = useState<string[]>([]);
  const [loadingId,  setLoadingId ] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const open = !!song && !!user;

  const handleAdd = async (playlistId: string) => {
    if (!song || loadingId) return;
    setLoadingId(playlistId);
    await addSongToPlaylist(playlistId, song.id);
    setAdded(p => [...p, playlistId]);
    setLoadingId(null);
    setTimeout(() => { setAdded([]); onClose(); }, 800);
  };

  const handleClose = () => {
    if (loadingId) return;
    setAdded([]);
    onClose();
  };

  const modal = (
    // ✅ AnimatePresence has EXACTLY ONE child — the full-screen overlay div
    <AnimatePresence>
      {open && (
        <motion.div
          key="atp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
          style={{
            position:       'fixed',
            inset:          0,
            zIndex:         9999,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '16px',
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* ✅ Modal panel — scale animation separate, click stops propagation */}
          <motion.div
            initial={{ scale: 0.93, y: 20 }}
            animate={{ scale: 1,    y: 0  }}
            exit={{   scale: 0.93, y: 20  }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(92vw, 420px)', maxHeight: '80vh' }}
            className="bg-[#141418] border border-white/[0.09] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-[14.5px] font-bold text-white">Add to Playlist</p>
                <p className="text-[11.5px] text-zinc-500 mt-0.5 truncate">{song?.title}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Playlist button */}
            <button
              onClick={() => setShowCreate(true)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/4 active:bg-white/6 border-b border-white/[0.05] transition-colors flex-shrink-0 w-full"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 text-violet-400" />
              </div>
              <span className="text-[13.5px] font-semibold text-violet-300">New Playlist</span>
            </button>

            {/* List */}
            <div className="overflow-y-auto flex-1 py-1">
              {playlists.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center px-6">
                  <ListMusic className="w-9 h-9 text-zinc-700 mb-3" />
                  <p className="text-[13px] text-zinc-500 font-medium">No playlists yet</p>
                  <p className="text-[11.5px] text-zinc-700 mt-1">Tap "New Playlist" above</p>
                </div>
              ) : (
                playlists.map(pl => {
                  const isDone    = added.includes(pl.id);
                  const alreadyIn = pl.songIds?.includes(song?.id ?? '');
                  const isThis    = loadingId === pl.id;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => !alreadyIn && !isDone && handleAdd(pl.id)}
                      disabled={!!(alreadyIn || isDone || loadingId)}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      className="flex items-center gap-3 w-full px-5 py-3 hover:bg-white/4 active:bg-white/6 disabled:cursor-default transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${
                        isDone || alreadyIn
                          ? 'bg-violet-600/20 border-violet-500/30'
                          : 'bg-zinc-800/80 border-white/[0.06]'
                      }`}>
                        <ListMusic className={`w-4 h-4 ${isDone || alreadyIn ? 'text-violet-400' : 'text-zinc-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[13.5px] font-medium text-white truncate">{pl.name}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {pl.songIds?.length ?? 0} song{(pl.songIds?.length ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="w-6 flex items-center justify-center flex-shrink-0">
                        {isThis ? (
                          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                        ) : isDone || alreadyIn ? (
                          <div className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-violet-400" />
                          </div>
                        ) : (
                          <Plus className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="h-3 flex-shrink-0" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(modal, document.body)}
      <CreatePlaylistModal open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
};