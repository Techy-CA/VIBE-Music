import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, SkipBack, SkipForward,
  Play, Pause, Heart, ListMusic,
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLikes }       from '../../hooks/useLikes';
import { useAuthStore }   from '../../store/useAuthStore';
import { cn }             from '../../utils/cn';

// ── Helpers ────────────────────────────────────────────────
const fmt = (s: number) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// ── Equalizer ──────────────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-[2px] h-3">
    {[2,3,2].map((h,i) => (
      <motion.span key={i} className="w-[3px] bg-white rounded-full"
        animate={{ height: [h, h+4, h] }}
        transition={{ repeat: Infinity, duration: 0.5, delay: i*0.1 }}
        style={{ height: h }} />
    ))}
  </div>
);

// ── Seek Bar ───────────────────────────────────────────────
const FullSeekBar = ({ value, max, onSeek }: {
  value: number; max: number; onSeek: (v: number) => void;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [local, setLocal] = useState<number | null>(null);

  const getPct = (clientX: number) => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.min(Math.max((clientX - left) / width, 0), 1);
  };

  const pct = local !== null ? local * 100 : (max > 0 ? (value / max) * 100 : 0);

  return (
    <div className="w-full px-1">
      <div
        ref={trackRef}
        className="relative w-full cursor-pointer"
        style={{ height: 28, touchAction: 'none' }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          setLocal(getPct(e.clientX));
        }}
        onPointerMove={e => {
          if (!dragging.current) return;
          setLocal(getPct(e.clientX));
        }}
        onPointerUp={e => {
          dragging.current = false;
          const p = getPct(e.clientX);
          setLocal(null);
          onSeek(p * max);
        }}
      >
        {/* Track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/20 rounded-full" />
        {/* Fill */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white rounded-full pointer-events-none"
          style={{
            width: `${pct}%`,
            transition: dragging.current ? 'none' : 'width 0.3s linear',
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-xl pointer-events-none"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[11px] text-white/50 tabular-nums">{fmt(value)}</span>
        <span className="text-[11px] text-white/50 tabular-nums">{fmt(max)}</span>
      </div>
    </div>
  );
};

// ── Full Screen Player ─────────────────────────────────────
export const FullScreenPlayer = ({
  open, onClose,
}: { open: boolean; onClose: () => void }) => {

  // ✅ Individual selectors — each re-renders only when its value changes
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const currentTime = usePlayerStore(s => s.currentTime);
  const duration    = usePlayerStore(s => s.duration);
  const queue       = usePlayerStore(s => s.queue);
  const pause       = usePlayerStore(s => s.pause);
  const resume      = usePlayerStore(s => s.resume);
  const playNext    = usePlayerStore(s => s.playNext);
  const toggleQueue = usePlayerStore(s => s.toggleQueue);

  // ✅ seek comes from store — set by PlayerEngine, no second YT instance
  const seekFn = usePlayerStore(s => s.seekFn);

  const { likedIds, handleToggle } = useLikes();
  const user = useAuthStore(s => s.user);

  if (!currentSong) return null;

  const isPlaying = status === 'playing';
  const isLiked   = likedIds.has(currentSong.id);

  const handleSeek = (seconds: number) => {
    seekFn?.(seconds);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 33 }}
          className="fixed inset-0 z-[100] flex flex-col lg:hidden"
          style={{ background: '#0d0d0d' }}
        >
          {/* Blurred background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <img
              src={currentSong.thumbnail} alt=""
              className="w-full h-full object-cover scale-110 blur-2xl opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" />
          </div>

          {/* Content */}
          <div className="relative flex flex-col h-full px-6 pb-10 pt-4">

            {/* Top bar */}
            <div className="flex items-center justify-between mb-8 pt-2">
              <button
                onClick={onClose}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </button>
              <p className="text-[12px] font-semibold text-white/60 uppercase tracking-widest">
                Now Playing
              </p>
              <button
                onClick={toggleQueue}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              >
                <ListMusic className="w-4 h-4 text-white/80" />
                {queue.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-400" />
                )}
              </button>
            </div>

            {/* Album Art */}
            <motion.div
              key={currentSong.id}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="flex-1 flex items-center justify-center mb-8"
            >
              <div className={cn(
                'w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden shadow-2xl',
                isPlaying && 'ring-4 ring-violet-500/40',
              )}>
                <img
                  src={currentSong.thumbnail} alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Title + Like */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-[18px] font-bold text-white truncate leading-tight">
                  {currentSong.title}
                </p>
                {isPlaying && (
                  <div className="flex items-center gap-2 mt-1">
                    <EqBars />
                    <span className="text-[11px] text-violet-400 font-medium">Playing</span>
                  </div>
                )}
              </div>
              {user && (
                <motion.button
                  whileTap={{ scale: 0.75 }}
                  onClick={() => handleToggle(currentSong.id)}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0',
                    isLiked ? 'text-pink-500' : 'text-white/40',
                  )}
                >
                  <Heart className={cn('w-6 h-6', isLiked && 'fill-pink-500')} />
                </motion.button>
              )}
            </div>

            {/* Seek Bar */}
            <div className="mb-6">
              <FullSeekBar
                value={currentTime}
                max={duration > 0 ? duration : 1}
                onSeek={handleSeek}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-2">
              <motion.button
                whileTap={{ scale: 0.85 }}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-12 h-12 flex items-center justify-center text-white/30"
                disabled
              >
                <SkipBack className="w-6 h-6" />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={isPlaying ? pause : resume}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl"
              >
                {status === 'loading'
                  ? <span className="w-6 h-6 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                  : isPlaying
                  ? <Pause className="w-6 h-6 text-zinc-900 fill-zinc-900" />
                  : <Play  className="w-6 h-6 text-zinc-900 fill-zinc-900 ml-1" />}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={playNext}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-12 h-12 flex items-center justify-center text-white/80"
              >
                <SkipForward className="w-6 h-6" />
              </motion.button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};