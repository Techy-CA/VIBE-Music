// src/components/player/QueuePanel.tsx
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, ListMusic, Trash2, GripVertical, ListPlus, Shuffle, Timer, Music2 } from 'lucide-react';
import { usePlayerStore }     from '../../store/usePlayerStore';
import { useAuthStore }       from '../../store/useAuthStore';
import { AddToPlaylistModal } from '../playlist/AddToPlaylistModal';
import { cn } from '../../utils/cn';
import type { Song } from '../../types';

// ── Equalizer bars ───────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-px h-3">
    {[2, 3, 2].map((h, i) => (
      <motion.span key={i} className="w-0.5 bg-violet-400 rounded-full"
        animate={{ height: [h, h + 3, h] }}
        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
        style={{ height: h }}
      />
    ))}
  </div>
);

// ── Queue item ───────────────────────────────────────────
const QueueItem = ({
  song, isActive, onRemove, onAddToPlaylist, onClick,
}: {
  song: Song;
  isActive?: boolean;
  onRemove?: () => void;
  onAddToPlaylist: (s: Song) => void;
  onClick?: () => void;
}) => {
  const user = useAuthStore(s => s.user);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, height: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-2 py-2 rounded-xl group transition-all duration-150 cursor-pointer',
        isActive
          ? 'bg-violet-500/8 border border-violet-500/20'
          : 'hover:bg-white/4 border border-transparent',
      )}
    >
      <GripVertical className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />

      <div className="relative flex-shrink-0">
        <img src={song.thumbnail} alt={song.title}
          className={cn(
            'w-9 h-9 rounded-lg object-cover',
            isActive && 'ring-1 ring-violet-500/50',
          )}
        />
        {isActive && (
          <div className="absolute inset-0 rounded-lg bg-black/30 flex items-center justify-center">
            <EqBars />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[12.5px] font-medium truncate transition-colors',
          isActive ? 'text-violet-300' : 'text-zinc-300 group-hover:text-white',
        )}>
          {song.title}
        </p>
        <p className="text-[10.5px] text-zinc-600">♥ {song.likeCount}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {user && (
          <button
            onClick={e => { e.stopPropagation(); onAddToPlaylist(song); }}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
          >
            <ListPlus className="w-3.5 h-3.5" />
          </button>
        )}
        {!isActive && onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ── Shared content (used by both mobile + desktop) ───────
const QueueContent = ({
  onAddToPlaylist,
}: {
  onAddToPlaylist: (s: Song) => void;
}) => {
  const { queue, currentSong, removeFromQueue, clearQueue, play, toggleQueue } =
    usePlayerStore();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <ListMusic className="w-4 h-4 text-zinc-500" />
          <h2 className="text-[14px] font-semibold text-white">Queue</h2>
          {queue.length > 0 && (
            <span className="text-[11px] bg-white/8 text-zinc-400 px-1.5 py-0.5 rounded-md">
              {queue.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button onClick={clearQueue}
              className="text-[11.5px] text-zinc-600 hover:text-red-400 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
          <button onClick={toggleQueue}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/8 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Now Playing */}
      {currentSong && (
        <div className="px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
          <p className="text-[10.5px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2">
            Now Playing
          </p>
          <QueueItem
            song={currentSong}
            isActive
            onAddToPlaylist={onAddToPlaylist}
          />
        </div>
      )}

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 scrollbar-hide overscroll-contain">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-white/4 border border-dashed border-white/8 flex items-center justify-center mb-3">
              <Music2 className="w-5 h-5 text-zinc-700" />
            </div>
            <p className="text-[13px] text-zinc-500 font-medium">Queue is empty</p>
            <p className="text-[11.5px] text-zinc-700 mt-1 max-w-[200px] leading-relaxed">
              Add songs using the + button on any track
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10.5px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2 px-1">
              Up Next
            </p>
            <AnimatePresence mode="popLayout">
              {queue.map(song => (
                <QueueItem
                  key={song.id}
                  song={song}
                  onRemove={() => removeFromQueue(song.id)}
                  onAddToPlaylist={onAddToPlaylist}
                  onClick={() => play(song)}
                />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>
    </>
  );
};

// ════════════════════════════════════════════════════════
// ── Main Export ─────────────────────────────────────────
// ════════════════════════════════════════════════════════
export const QueuePanel = () => {
  const queueVisible = usePlayerStore(s => s.queueVisible);
  const toggleQueue  = usePlayerStore(s => s.toggleQueue);
  const currentSong  = usePlayerStore(s => s.currentSong);

  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);
  const [shuffle, setShuffle]           = useState(false);
  const [timerActive, setTimerActive]   = useState(false);

  const dragControls = useDragControls();

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.y > 100) toggleQueue();
  };

  // ✅ Portal — document.body mein render, koi bhi parent
  //    stacking context affect nahi karega
  return createPortal(
    <>
      <AddToPlaylistModal
        song={playlistSong}
        onClose={() => setPlaylistSong(null)}
      />

      <AnimatePresence>
        {queueVisible && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={toggleQueue}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            />

            {/* ── MOBILE: Bottom Sheet (< sm) ──────────── */}
            <motion.div
              key="bottom-sheet"
              drag="y"
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.4 }}
              onDragEnd={handleDragEnd}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
              className="sm:hidden fixed bottom-0 left-0 right-0 z-[9999] flex flex-col rounded-t-3xl overflow-hidden"
              style={{
                maxHeight: '88dvh',
                background: '#161618',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
              }}
            >
              {/* Blurred thumbnail bg */}
              {currentSong && (
                <div className="absolute inset-x-0 top-0 h-36 overflow-hidden rounded-t-3xl pointer-events-none">
                  <img src={currentSong.thumbnail} alt=""
                    className="w-full h-full object-cover scale-110 blur-2xl opacity-25"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#161618]" />
                </div>
              )}

              {/* Drag handle */}
              <div
                onPointerDown={e => dragControls.start(e)}
                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing z-10 flex-shrink-0"
              >
                <div className="w-9 h-1 rounded-full bg-white/20" />
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 overflow-hidden z-10">
                <QueueContent onAddToPlaylist={setPlaylistSong} />
              </div>

              {/* Shuffle + Timer bar */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.06] flex-shrink-0 z-10"
                style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
              >
                <button
                  onClick={() => setShuffle(p => !p)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-semibold transition-all active:scale-95',
                    shuffle
                      ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                      : 'bg-white/5 text-zinc-500 border border-white/[0.06]',
                  )}
                >
                  <Shuffle className="w-4 h-4" /> Shuffle
                </button>
                <button
                  onClick={() => setTimerActive(p => !p)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-semibold transition-all active:scale-95',
                    timerActive
                      ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                      : 'bg-white/5 text-zinc-500 border border-white/[0.06]',
                  )}
                >
                  <Timer className="w-4 h-4" /> Timer
                </button>
              </div>
            </motion.div>

            {/* ── DESKTOP: Side Panel (sm+) ─────────────── */}
            <motion.div
              key="side-panel"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="hidden sm:flex fixed right-0 top-0 bottom-0 w-[340px] flex-col bg-[#111111] border-l border-white/[0.07] z-[9999]"
            >
              <QueueContent onAddToPlaylist={setPlaylistSong} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body  // ✅ portal target
  );
};