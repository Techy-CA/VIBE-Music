import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Play, ListMusic, Trash2,
  MoreHorizontal, Pencil, Shuffle, Heart, X,
} from 'lucide-react';
import { usePlaylists }       from '../hooks/usePlaylist';
import { useAllSongs }        from '../hooks/useSongs';
import { useLikes }           from '../hooks/useLikes';
import { usePlayerStore }     from '../store/usePlayerStore';
import { EditPlaylistModal }  from '../components/playlist/EditPlaylistModal';
import { ConfirmDialog }      from '../components/ui/ConfirmDialog';
import { cn }                 from '../utils/cn';
import type { Song }          from '../types';


// ── Equalizer ──────────────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-px h-3.5">
    {[2,3,2].map((h,i) => (
      <motion.span key={i} className="w-0.5 bg-violet-400 rounded-full"
        animate={{ height: [h, h+4, h] }}
        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.12 }}
        style={{ height: h }} />
    ))}
  </div>
);


// ── Mosaic Cover ───────────────────────────────────────────
const MosaicCover = ({ songs, className = '' }: { songs: Song[]; className?: string }) => {
  const t = songs.slice(0, 4);
  if (t.length === 0) return (
    <div className={cn('rounded-2xl bg-gradient-to-br from-violet-900/60 via-zinc-900 to-zinc-800 flex items-center justify-center', className)}>
      <ListMusic className="w-12 h-12 text-violet-400/20" />
    </div>
  );
  if (t.length === 1) return (
    <div className={cn('rounded-2xl overflow-hidden', className)}>
      <img src={t[0].thumbnail} alt="" className="w-full h-full object-cover" />
    </div>
  );
  return (
    <div className={cn('rounded-2xl overflow-hidden grid gap-px', t.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2', className)}>
      {t.length === 3 ? (
        <>
          <img src={t[0].thumbnail} alt="" className="w-full h-full object-cover row-span-2" />
          <img src={t[1].thumbnail} alt="" className="w-full h-full object-cover" />
          <img src={t[2].thumbnail} alt="" className="w-full h-full object-cover" />
        </>
      ) : (
        t.map((s, i) => <img key={i} src={s.thumbnail} alt="" className="w-full h-full object-cover" />)
      )}
    </div>
  );
};


// ── Song Row ───────────────────────────────────────────────
const SongRow = ({
  song, index, pool, onRemove,
}: {
  song: Song; index: number; pool: Song[];
  onRemove: (id: string) => void;
}) => {
  const play        = usePlayerStore(s => s.play);
  const setCatPool  = usePlayerStore(s => s.setCategoryPool);
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const { likedIds, handleToggle } = useLikes();

  const isActive  = currentSong?.id === song.id;
  const isPlaying = isActive && status === 'playing';
  const liked     = likedIds.has(song.id);

  const handlePlay = () => { play(song, pool); setCatPool(pool); };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.2 }}
      onClick={handlePlay}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group border select-none',
        isActive ? 'bg-white/7 border-white/8' : 'hover:bg-white/4 active:bg-white/6 border-transparent',
      )}
    >
      {/* Index / eq */}
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {isPlaying
          ? <EqBars />
          : <>
              <span className="text-[11px] text-zinc-600 group-hover:hidden w-5 text-center">{index + 1}</span>
              <Play className="w-3.5 h-3.5 text-zinc-400 hidden group-hover:block fill-zinc-400 ml-0.5" />
            </>
        }
      </div>

      {/* Art */}
      <div className="relative flex-shrink-0">
        <img src={song.thumbnail} alt={song.title}
          className={cn('w-10 h-10 rounded-lg object-cover', isActive && 'ring-1 ring-violet-500/60')} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] font-medium truncate transition-colors',
          isActive ? 'text-violet-300' : 'text-zinc-200 group-hover:text-white',
        )}>{song.title}</p>
        <p className="text-[10.5px] text-zinc-600 mt-0.5 truncate">{song.addedByName ?? 'Unknown'}</p>
      </div>

      {/* Like */}
      <button
        onClick={e => { e.stopPropagation(); handleToggle(song.id); }}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 text-[11px] transition-all px-1',
          liked ? 'text-pink-500' : 'text-zinc-700 hover:text-pink-400',
        )}
      >
        <Heart className={cn('w-3.5 h-3.5', liked && 'fill-pink-500')} />
        <span className="hidden sm:inline">{song.likeCount}</span>
      </button>

      {/* Remove */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(song.id); }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
        title="Remove from playlist"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};


// ── Page ───────────────────────────────────────────────────
export default function PlaylistDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { playlists, removeSongFromPlaylist, deletePlaylist } = usePlaylists();
  const { songs: allSongs } = useAllSongs();
  const play        = usePlayerStore(s => s.play);
  const setCatPool  = usePlayerStore(s => s.setCategoryPool);

  const [showEdit,          setShowEdit         ] = useState(false);
  const [showOptions,       setShowOptions      ] = useState(false);
  const [deleting,          setDeleting         ] = useState(false);
  const [removing,          setRemoving         ] = useState<string | null>(null);
  // ✅ Custom confirm dialog states
  const [confirmDelete,     setConfirmDelete    ] = useState(false);
  const [confirmRemoveSong, setConfirmRemoveSong] = useState<string | null>(null);

  const playlist = playlists.find(p => p.id === id);

  const poolSongs = useMemo(() => {
    if (!playlist) return [];
    return playlist.songIds
      .map(sid => allSongs.find(s => s.id === sid))
      .filter(Boolean) as Song[];
  }, [playlist, allSongs]);

  const handlePlayAll = () => {
    if (!poolSongs.length) return;
    play(poolSongs[0], poolSongs);
    setCatPool(poolSongs);
  };

  const handleShuffle = () => {
    if (!poolSongs.length) return;
    const shuffled = [...poolSongs].sort(() => Math.random() - 0.5);
    play(shuffled[0], shuffled);
    setCatPool(shuffled);
  };

  // ✅ Opens custom dialog instead of browser confirm()
  const handleRemoveSong = (songId: string) => {
    if (removing) return;
    setConfirmRemoveSong(songId);
  };

  const doRemoveSong = async () => {
    if (!playlist || !confirmRemoveSong) return;
    const songId = confirmRemoveSong;
    setConfirmRemoveSong(null);
    setRemoving(songId);
    await removeSongFromPlaylist(playlist.id, songId);
    setRemoving(null);
  };

  // ✅ Opens custom dialog instead of browser confirm()
  const handleDeletePlaylist = () => {
    if (!playlist || deleting) return;
    setShowOptions(false);
    setConfirmDelete(true);
  };

  const doDeletePlaylist = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    await deletePlaylist(playlist!.id);
    navigate('/playlists');
  };

  if (!playlist && playlists.length === 0) return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/4 border border-dashed border-white/10 flex items-center justify-center mb-4 animate-pulse">
        <ListMusic className="w-7 h-7 text-zinc-700" />
      </div>
      <p className="text-[13px] text-zinc-500">Loading...</p>
    </div>
  );

  if (!playlist) return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-[14px] font-medium text-zinc-400 mb-4">Playlist not found</p>
      <button onClick={() => navigate('/playlists')}
        className="text-[12.5px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Back to Playlists
      </button>
    </div>
  );

  return (
    <div className="pb-8">
      {/* Modals */}
      <EditPlaylistModal playlist={showEdit ? playlist : null} onClose={() => setShowEdit(false)} />

      {/* ✅ Delete playlist confirm */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Playlist"
        message={`"${playlist.name}" playlist will be permanently deleted and cannot be recovered. Are you sure?`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={doDeletePlaylist}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* ✅ Remove song confirm */}
      <ConfirmDialog
        open={!!confirmRemoveSong}
        title="Remove Song"
        message="Yeh song playlist se remove ho jayega."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onConfirm={doRemoveSong}
        onCancel={() => setConfirmRemoveSong(null)}
      />

      {/* Back */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate('/playlists')}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          className="flex items-center gap-1.5 text-[12.5px] text-zinc-500 hover:text-zinc-200 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Your Playlists
        </button>

        {/* Options menu */}
        <div className="relative">
          <button
            onClick={() => setShowOptions(p => !p)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {showOptions && (
              <motion.div
                key="options-menu"
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{   opacity: 0, scale: 0.92        }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-10 z-50 bg-[#1c1c22] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[180px]"
                onClick={() => setShowOptions(false)}
              >
                <button
                  onClick={() => { setShowOptions(false); setShowEdit(true); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12.5px] text-zinc-200 hover:bg-white/6 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-zinc-500" /> Edit Playlist
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={handleDeletePlaylist}
                  disabled={deleting}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12.5px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Deleting...' : 'Delete Playlist'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 mb-7 p-5 rounded-2xl bg-gradient-to-br from-violet-900/15 to-zinc-900/40 border border-white/[0.06]">
        <MosaicCover
          songs={poolSongs}
          className="w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0 shadow-2xl"
        />
        <div className="flex-1 min-w-0 text-center sm:text-left pb-1">
          <p className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Playlist</p>
          <h1 className="text-[24px] sm:text-[28px] font-extrabold text-white tracking-tight leading-tight truncate">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-[12px] text-zinc-500 mt-1.5 line-clamp-2">{playlist.description}</p>
          )}
          <p className="text-[12px] text-zinc-600 mt-2">
            {poolSongs.length} song{poolSongs.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2.5 mt-4 justify-center sm:justify-start flex-wrap">
            <button
              onClick={handlePlayAll}
              disabled={!poolSongs.length}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-all shadow-lg shadow-violet-600/20"
            >
              <Play className="w-4 h-4 fill-white" /> Play All
            </button>
            <button
              onClick={handleShuffle}
              disabled={!poolSongs.length}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/[0.08] hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-[13px] font-medium transition-all"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
            <button
              onClick={() => setShowEdit(true)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/[0.08] hover:bg-white/12 text-zinc-300 text-[13px] font-medium transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        </div>
      </div>

      {/* Song List */}
      {poolSongs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/4 border border-dashed border-white/10 flex items-center justify-center mb-4">
            <ListMusic className="w-7 h-7 text-zinc-700" />
          </div>
          <p className="text-[13.5px] font-medium text-zinc-400">No songs yet</p>
          <p className="text-[12px] text-zinc-600 mt-1.5 max-w-[240px]">
            Tap the <span className="text-violet-400">+ playlist</span> icon on any song to add it here
          </p>
        </motion.div>
      ) : (
        <div className="space-y-0.5">
          {poolSongs.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              index={i}
              pool={poolSongs}
              onRemove={handleRemoveSong}
            />
          ))}
        </div>
      )}
    </div>
  );
}