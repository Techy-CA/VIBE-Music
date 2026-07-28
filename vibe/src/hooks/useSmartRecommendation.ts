import { useCallback } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Song } from '../types';

export const useSmartRecommendation = () => {
  const queue = usePlayerStore(s => s.queue);

  const getNextRecommendation = useCallback(
    async (fromSong: Song): Promise<Song | null> => {
      // ── Priority 1: Manual queue ─────────────────────────
      if (queue.length > 0) return queue[0];

      // ── Priority 2: Tag-based smart match ───────────────
      const tags = fromSong.tags ?? [];
      if (tags.length > 0) {
        try {
          const snap = await getDocs(
            query(
              collection(db, 'songs'),
              where('tags', 'array-contains-any', tags),
              limit(25),
            ),
          );
          const candidates = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Song))
            .filter(s => s.id !== fromSong.id);

          if (candidates.length > 0) {
            // Score by shared tag count + small jitter for variety
            const scored = candidates
              .map(s => ({
                s,
                score:
                  (s.tags ?? []).filter(t => tags.includes(t)).length +
                  Math.random() * 0.4,
              }))
              .sort((a, b) => b.score - a.score);

            // Pick randomly from top 5 so it doesn't feel robotic
            const top = scored.slice(0, Math.min(5, scored.length));
            return top[Math.floor(Math.random() * top.length)].s;
          }
        } catch (err) {
          console.error('[SmartRec] tag query failed:', err);
        }
      }

      // ── Priority 3: Random fallback ──────────────────────
      try {
        const snap = await getDocs(query(collection(db, 'songs'), limit(40)));
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Song))
          .filter(s => s.id !== fromSong.id);
        if (all.length > 0) return all[Math.floor(Math.random() * all.length)];
      } catch {}

      return null;
    },
    [queue],
  );

  return { getNextRecommendation };
};