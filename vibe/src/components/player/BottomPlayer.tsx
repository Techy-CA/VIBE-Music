import { useState } from 'react';
import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, Volume2, VolumeX, Heart, ListMusic } from 'lucide-react';
import { cn }             from '../../utils/cn';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLikes }       from '../../hooks/useLikes';
import { useAuthStore }   from '../../store/useAuthStore';
import { useSmartQueue }  from '../../hooks/useSmartQueue';


const fmt = (s: number) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};


// ── Seek Bar ───────────────────────────────────────────────
const SeekBar = ({
  value, max, onChange, onDragStart, onDragEnd,
}: {
  value: number; max: number;
  onChange: (v: number) => void;
  onDragStart: () => void;
  onDragEnd: (v: number) => void;
}) => {
  const trackRef   = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [localPct, setLocalPct] = useState<number | null>(null);

  const getPct = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return Math.min(Math.max((clientX - left) / width, 0), 1);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    onDragStart();
    const pct = getPct(e.clientX);
    setLocalPct(pct);
    onChange(pct * max);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const pct = getPct(e.clientX);
    setLocalPct(pct);
    onChange(pct * max);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const pct = getPct(e.clientX);
    setLocalPct(null);
    onDragEnd(pct * max);
  };

  const displayPct = localPct !== null
    ? localPct * 100
    : max > 0 ? (value / max) * 100 : 0;

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative flex items-center cursor-pointer group"
      style={{ height: 18 }}
    >
      <div className="absolute inset-y-0 left-0 right-0 my-auto h-[3px] rounded-full bg-white/10" />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-violet-400/90 pointer-events-none"
        style={{
          width: `${displayPct}%`,
          transition: isDragging.current ? 'none' : 'width 0.25s linear',
        }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `${displayPct}%` }}
      />
    </div>
  );
};


// ── Volume Bar ─────────────────────────────────────────────
const VolumeBar = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const ref      = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getPct = (clientX: number) => {
    if (!ref.current) return 0;
    const { left, width } = ref.current.getBoundingClientRect();
    return Math.min(Math.max((clientX - left) / width, 0), 1);
  };

  return (
    <div ref={ref}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; onChange(getPct(e.clientX) * 100); }}
      onPointerMove={e => { if (dragging.current) onChange(getPct(e.clientX) * 100); }}
      onPointerUp={e   => { dragging.current = false; onChange(getPct(e.clientX) * 100); }}
      className="relative flex items-center cursor-pointer group w-[80px]"
      style={{ height: 16 }}
    >
      <div className="absolute inset-y-0 left-0 right-0 my-auto h-[3px] rounded-full bg-white/10" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-white/50 pointer-events-none"
        style={{ width: `${value}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: `${value}%` }} />
    </div>
  );
};


// ── EQ Bars ────────────────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-px h-3">
    {[2, 3, 2].map((h, i) => (
      <motion.span key={i} className="w-0.5 bg-violet-400 rounded-full"
        animate={{ height: [h, h + 3, h] }}
        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
        style={{ height: h }} />
    ))}
  </div>
);


// ── Bottom Player ──────────────────────────────────────────
export const BottomPlayer = () => {
  const currentSong        = usePlayerStore(s => s.currentSong);
  const status             = usePlayerStore(s => s.status);
  const volume             = usePlayerStore(s => s.volume);
  const isMuted            = usePlayerStore(s => s.isMuted);
  const currentTime        = usePlayerStore(s => s.currentTime);
  const duration           = usePlayerStore(s => s.duration);
  const queue              = usePlayerStore(s => s.queue);
  const queueVisible       = usePlayerStore(s => s.queueVisible);
  const pause              = usePlayerStore(s => s.pause);
  const resume             = usePlayerStore(s => s.resume);
  const setVolume          = usePlayerStore(s => s.setVolume);
  const toggleMute         = usePlayerStore(s => s.toggleMute);
  const setCurrentTime     = usePlayerStore(s => s.setCurrentTime);
  const playNext           = usePlayerStore(s => s.playNext);
  const toggleQueue        = usePlayerStore(s => s.toggleQueue);
  const seekFn             = usePlayerStore(s => s.seekFn);

  // ✅ Crossfade state
  const preloadedSong      = usePlayerStore(s => s.preloadedSong);
  const crossfadeProgress  = usePlayerStore(s => s.crossfadeProgress);
  const isCrossfading      = crossfadeProgress > 0;

  const { likedIds, handleToggle } = useLikes();
  const user = useAuthStore(s => s.user);
  const { logListenEvent } = useSmartQueue();

  const [isDragging, setIsDragging] = useState(false);

  if (!currentSong) return null;

  const isPlaying = status === 'playing';
  const isLiked   = likedIds.has(currentSong.id);

  const handleSkip = () => {
    void logListenEvent(currentSong, 'skipped', (currentSong.duration ?? 0) * 1000);
    playNext();
  };

  const handleLike = () => {
    handleToggle(currentSong.id);
    if (!likedIds.has(currentSong.id)) {
      void logListenEvent(currentSong, 'liked', (currentSong.duration ?? 0) * 1000);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="hidden lg:flex fixed bottom-5 z-50 flex-col"
        style={{ left: 'calc(220px + 16px)', right: '16px' }}
      >
        {/* Glass pill */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(18, 18, 22, 0.72)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Timeline */}
          <div className="px-4 pt-3 pb-1">
            <SeekBar
              value={currentTime}
              max={duration > 0 ? duration : 1}
              onChange={v => { if (isDragging) setCurrentTime(v); }}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={v => {
                setIsDragging(false);
                seekFn?.(v);
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-white/30 tabular-nums">{fmt(currentTime)}</span>
              <span className="text-[10px] text-white/30 tabular-nums">{fmt(duration)}</span>
            </div>
          </div>

          {/* ✅ Crossfade indicator — current fading out, next fading in */}
          <AnimatePresence>
            {isCrossfading && preloadedSong && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 overflow-hidden"
              >
                <div className="flex items-center gap-2.5 pb-2">
                  {/* Blend bar */}
                  <div className="flex-1 h-[2px] rounded-full bg-white/8 overflow-hidden relative">
                    {/* Current song fading out (violet) */}
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-violet-400/50"
                      style={{ width: `${(1 - crossfadeProgress) * 100}%` }}
                    />
                    {/* Next song fading in (emerald) */}
                    <div
                      className="absolute right-0 top-0 h-full rounded-full bg-emerald-400/60"
                      style={{ width: `${crossfadeProgress * 100}%` }}
                    />
                  </div>

                  {/* Up next info */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9.5px] text-white/20 uppercase tracking-wide">
                      Up next
                    </span>
                    <img
                      src={preloadedSong.thumbnail}
                      alt={preloadedSong.title}
                      className="w-3.5 h-3.5 rounded object-cover opacity-50"
                    />
                    <span className="text-[10px] text-white/30 truncate max-w-[110px]">
                      {preloadedSong.title}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center gap-3 px-4 pb-3.5">
            {/* Song info */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-shrink-0">
                <img
                  src={currentSong.thumbnail} alt={currentSong.title}
                  className={cn('w-9 h-9 rounded-xl object-cover',
                    isPlaying && 'ring-2 ring-violet-500/50')}
                />
                {isPlaying && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-violet-600 rounded-full flex items-center justify-center">
                    <EqBars />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[13px] font-medium text-white/90 truncate">
                  {currentSong.title}
                </p>
                {/* ✅ "Crossfading..." subtle label under title */}
                <AnimatePresence>
                  {isCrossfading && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[10px] text-emerald-400/60 font-medium"
                    >
                      Crossfading...
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {user && (
                <motion.button whileTap={{ scale: 0.75 }}
                  onClick={handleLike}
                  className={cn('transition-colors duration-150',
                    isLiked ? 'text-pink-500' : 'text-white/30 hover:text-white/70')}>
                  <Heart className={cn('w-4 h-4', isLiked && 'fill-pink-500')} />
                </motion.button>
              )}

              <motion.button whileTap={{ scale: 0.88 }}
                onClick={isPlaying ? pause : resume}
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  boxShadow: '0 2px 12px rgba(139,92,246,0.25)',
                }}
              >
                {status === 'loading'
                  ? <span className="w-4 h-4 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                  : isPlaying
                  ? <Pause className="w-3.5 h-3.5 text-zinc-900 fill-zinc-900" />
                  : <Play  className="w-3.5 h-3.5 text-zinc-900 fill-zinc-900 ml-px" />}
              </motion.button>

              <motion.button whileTap={{ scale: 0.88 }}
                onClick={handleSkip}
                className="text-white/30 hover:text-white/80 transition-colors duration-150">
                <SkipForward className="w-4 h-4" />
              </motion.button>

              <div className="flex items-center gap-2">
                <button onClick={toggleMute}
                  className="text-white/30 hover:text-white/70 transition-colors duration-150 flex-shrink-0">
                  {isMuted || volume === 0
                    ? <VolumeX className="w-4 h-4" />
                    : <Volume2 className="w-4 h-4" />}
                </button>
                <VolumeBar value={isMuted ? 0 : volume} onChange={setVolume} />
              </div>

              <motion.button whileTap={{ scale: 0.88 }}
                onClick={toggleQueue}
                className={cn(
                  'relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150',
                  queueVisible
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-white/30 hover:text-white/70 hover:bg-white/6',
                )}>
                <ListMusic className="w-4 h-4" />
                {queue.length > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};