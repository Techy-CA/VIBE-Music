import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ListMusic, Trash2, MoreVertical, Music2, Play } from 'lucide-react';
import { usePlaylists }        from '../hooks/usePlaylist';
import { useAllSongs }         from '../hooks/useSongs';
import { CreatePlaylistModal } from '../components/playlist/CreatePlaylistModal';
import { ConfirmDialog }       from '../components/ui/ConfirmDialog';
import { useAuthStore }        from '../store/useAuthStore';
import type { Song }           from '../types';


// ── Mosaic Cover ───────────────────────────────────────────
const PlaylistCover = ({ songIds, allSongs }: { songIds: string[]; allSongs: Song[] }) => {
  const thumbs = songIds
    .slice(0, 4)
    .map(id => allSongs.find(s => s.id === id))
    .filter(Boolean) as Song[];

  if (thumbs.length === 0) {
    return (
      <div className="aspect-square bg-gradient-to-br from-violet-900/50 via-zinc-900 to-zinc-800 flex items-center justify-center relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-violet-600/10 pointer-events-none" />
        <div className="absolute -left-4 -bottom-4 w-20 h-20 rounded-full bg-violet-800/10 pointer-events-none" />
        <ListMusic className="w-10 h-10 text-violet-400/30 z-10" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="w-4 h-4 text-zinc-900 fill-zinc-900 ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  if (thumbs.length === 1) {
    return (
      <div className="aspect-square overflow-hidden relative">
        <img src={thumbs[0].thumbnail} alt=""
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="w-4 h-4 text-zinc-900 fill-zinc-900 ml-0.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-square relative overflow-hidden">
      <div className={`w-full h-full grid gap-px ${thumbs.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
        {thumbs.length === 3 ? (
          <>
            <img src={thumbs[0].thumbnail} alt="" className="w-full h-full object-cover row-span-2 pointer-events-none" />
            <img src={thumbs[1].thumbnail} alt="" className="w-full h-full object-cover pointer-events-none" />
            <img src={thumbs[2].thumbnail} alt="" className="w-full h-full object-cover pointer-events-none" />
          </>
        ) : (
          thumbs.map((s, idx) => (
            <img key={idx} src={s.thumbnail} alt="" className="w-full h-full object-cover pointer-events-none" />
          ))
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
          <Play className="w-4 h-4 text-zinc-900 fill-zinc-900 ml-0.5" />
        </div>
      </div>
    </div>
  );
};


// ── Page ───────────────────────────────────────────────────
export default function Playlists() {
  const { playlists, isLoading, deletePlaylist } = usePlaylists();
  const { songs: allSongs } = useAllSongs();
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const [showCreate,     setShowCreate    ] = useState(false);
  const [menuOpen,       setMenuOpen      ] = useState<string | null>(null);
  const [deleting,       setDeleting      ] = useState<string | null>(null);
  // ✅ Custom confirm dialog state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ✅ Opens custom dialog — no browser confirm()
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpen(null);
    setConfirmDeleteId(id);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeleting(id);
    await deletePlaylist(id);
    setDeleting(null);
  };

  const handleCardClick = (id: string) => {
    if (menuOpen) { setMenuOpen(null); return; }
    navigate(`/playlist/${id}`);
  };

  const handleMenuToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuOpen(prev => prev === id ? null : id);
  };

  // ✅ Get name for confirm dialog message
  const confirmPlaylist = playlists.find(p => p.id === confirmDeleteId);

  if (!user) return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/4 border border-dashed border-white/10 flex items-center justify-center mb-4">
        <ListMusic className="w-7 h-7 text-zinc-700" />
      </div>
      <p className="text-[14px] font-medium text-zinc-400">Sign in to see your playlists</p>
      <p className="text-[12px] text-zinc-600 mt-1">Create and manage your music collections</p>
    </div>
  );

  return (
    <div className="pb-8">
      <CreatePlaylistModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* ✅ Custom confirm dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Playlist"
        message={`"${confirmPlaylist?.name ?? 'this playlist'}" playlist will be permanently deleted and cannot be recovered. Are you sure?`}
        confirmLabel={deleting === confirmDeleteId ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-white tracking-tight">Your Playlists</h1>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {isLoading ? 'Loading...' : `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-[12.5px] font-semibold transition-all shadow-lg shadow-violet-600/20"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/5 overflow-hidden animate-pulse">
              <div className="aspect-square bg-white/5" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-white/5 rounded w-3/4" />
                <div className="h-2.5 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && playlists.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-3xl bg-violet-600/10 border border-dashed border-violet-500/20 flex items-center justify-center mb-5">
            <Music2 className="w-9 h-9 text-violet-500/40" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-300">No playlists yet</p>
          <p className="text-[12.5px] text-zinc-600 mt-1.5 mb-6 max-w-[220px]">
            Create your first playlist to organise your music
          </p>
          <button
            onClick={() => setShowCreate(true)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold transition-all"
          >
            <Plus className="w-4 h-4" /> Create Playlist
          </button>
        </motion.div>
      )}

      {/* Grid */}
      {!isLoading && playlists.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          onClick={() => setMenuOpen(null)}
        >
          {playlists.map((pl, i) => (
            <motion.div
              key={pl.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.05, 0.2) }}
              onClick={() => handleCardClick(pl.id)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="relative group rounded-2xl bg-zinc-900 border border-white/[0.06] overflow-hidden cursor-pointer hover:border-white/10 hover:bg-zinc-800/80 transition-all duration-200 select-none"
            >
              <PlaylistCover songIds={pl.songIds ?? []} allSongs={allSongs} />

              <div className="p-3">
                <p className="text-[13px] font-semibold text-white truncate">{pl.name}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  {pl.songIds?.length ?? 0} song{(pl.songIds?.length ?? 0) !== 1 ? 's' : ''}
                </p>
                {pl.description
                  ? <p className="text-[10.5px] text-zinc-700 mt-0.5 truncate">{pl.description}</p>
                  : null
                }
              </div>

              {/* Context menu button */}
              <button
                onClick={e => handleMenuToggle(e, pl.id)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all z-30"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {menuOpen === pl.id && (
                  <motion.div
                    key={`menu-${pl.id}`}
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1,    y: 0  }}
                    exit={{   opacity: 0, scale: 0.92        }}
                    transition={{ duration: 0.12 }}
                    onClick={e => e.stopPropagation()}
                    className="absolute top-10 right-2 z-40 bg-[#1c1c22] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[150px]"
                  >
                    <button
                      onClick={e => handleDelete(e, pl.id)}
                      disabled={deleting === pl.id}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12.5px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting === pl.id ? 'Deleting...' : 'Delete Playlist'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}