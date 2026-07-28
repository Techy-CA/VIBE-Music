import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { FullScreenPlayer } from './FullScreenPlayer';
import { cn } from '../../utils/cn';

export const MobileBar = () => {
  // ✅ Individual selectors — each re-renders only when its own value changes
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const currentTime = usePlayerStore(s => s.currentTime);
  const duration    = usePlayerStore(s => s.duration);
  const pause       = usePlayerStore(s => s.pause);
  const resume      = usePlayerStore(s => s.resume);
  const playNext    = usePlayerStore(s => s.playNext);

  const [open, setOpen] = useState(false);

  if (!currentSong) return null;

  const isPlaying = status === 'playing';
  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <>
      <FullScreenPlayer open={open} onClose={() => setOpen(false)} />

      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="lg:hidden fixed left-0 right-0 z-40"
          style={{ bottom: 60 }}
        >
          {/* ✅ Timeline — updates every 500ms as currentTime changes */}
          <div className="h-[3px] bg-white/10 w-full">
            <div
              className="h-full bg-violet-500"
              style={{
                width: `${pct}%`,
                transition: 'width 0.4s linear',
              }}
            />
          </div>

          {/* Bar */}
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{
              background: 'rgba(14,14,18,0.97)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Thumbnail + title → opens full screen */}
            <div
              className="flex items-center gap-2.5 flex-1 min-w-0"
              onClick={() => setOpen(true)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={currentSong.thumbnail}
                  alt={currentSong.title}
                  className={cn(
                    'w-10 h-10 rounded-xl object-cover',
                    isPlaying && 'ring-2 ring-violet-500/50',
                  )}
                />
                {isPlaying && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-violet-600 rounded-full flex items-center justify-center">
                    <div className="flex items-end gap-px h-2">
                      {[1,2,1].map((h,i) => (
                        <motion.span key={i} className="w-px bg-white rounded-full"
                          animate={{ height: [h, h+2, h] }}
                          transition={{ repeat: Infinity, duration: 0.5, delay: i*0.12 }}
                          style={{ height: h }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[13px] font-semibold text-white truncate">
                {currentSong.title}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={isPlaying ? pause : resume}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow"
              >
                {status === 'loading'
                  ? <span className="w-4 h-4 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                  : isPlaying
                  ? <Pause className="w-4 h-4 text-zinc-900 fill-zinc-900" />
                  : <Play  className="w-4 h-4 text-zinc-900 fill-zinc-900 ml-0.5" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={playNext}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};