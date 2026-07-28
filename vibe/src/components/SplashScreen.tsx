// src/components/SplashScreen.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onDone: () => void;
}

export const SplashScreen = ({ onDone }: Props) => {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'),  2000);
    const t3 = setTimeout(() => onDone(),          2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase !== 'out' ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: [0.32, 0, 0.67, 0] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: '#0a0a0b' }}
        >
          {/* Ambient glow blobs */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.35, scale: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute w-[420px] h-[420px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
              top: '15%', left: '50%', transform: 'translateX(-50%)',
              filter: 'blur(60px)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.2, scale: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
            className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #4f46e5 0%, transparent 70%)',
              bottom: '20%', left: '20%',
              filter: 'blur(50px)',
            }}
          />

          {/* Logo mark + wordmark */}
          <div className="relative flex flex-col items-center gap-5 z-10">

            {/* Logo icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative w-20 h-20"
            >
              {/* Outer ring pulse */}
              <motion.div
                animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-2xl"
                style={{ background: 'rgba(124,58,237,0.4)' }}
              />

              {/* Icon bg */}
              <div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  boxShadow: '0 0 40px rgba(124,58,237,0.5), 0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                {/* Music note SVG */}
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <motion.path
                    d="M16 30V12l16-4v18"
                    stroke="white" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
                  />
                  <motion.circle cx="11" cy="30" r="4"
                    fill="white"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.8, ease: [0.34,1.56,0.64,1] }}
                  />
                  <motion.circle cx="27" cy="26" r="4"
                    fill="white"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.95, ease: [0.34,1.56,0.64,1] }}
                  />
                </svg>
              </div>
            </motion.div>

            {/* Wordmark */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center gap-1"
            >
              <h1
                className="text-white font-bold tracking-tight"
                style={{ fontSize: '2.75rem', lineHeight: 1, letterSpacing: '-0.03em' }}
              >
                Zuno
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.85, duration: 0.4 }}
                className="text-zinc-500 text-[13px] font-medium tracking-widest uppercase"
              >
                Music for you
              </motion.p>
            </motion.div>
          </div>

          {/* Equalizer bars at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="absolute bottom-14 flex items-end gap-1"
          >
            {[14, 22, 18, 26, 16, 20, 12].map((h, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full"
                style={{ background: 'rgba(124,58,237,0.7)' }}
                animate={{ height: [h, h + 10, h - 4, h + 6, h] }}
                transition={{
                  repeat: Infinity,
                  duration: 0.8 + i * 0.07,
                  delay: i * 0.08,
                  ease: 'easeInOut',
                }}
                initial={{ height: h }}
              />
            ))}
          </motion.div>

          {/* Bottom tag */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="absolute bottom-6 text-[11px] text-zinc-700 font-medium"
          >
            by EpicApp Innovations
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};