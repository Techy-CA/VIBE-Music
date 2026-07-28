import { useEffect, useRef, useCallback } from 'react';
import {
  doc, getDoc, collection, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db }                from '../lib/firebase';
import { usePlayerStore }    from '../store/usePlayerStore';
import { useAuthStore }      from '../store/useAuthStore';
import { useAllSongs }       from './useSongs';
import { buildSmartQueue }   from '../lib/recommendations/scoreEngine';
import type { Song, UserTasteProfile, ListenEvent } from '../types';

export function useSmartQueue() {
  const currentSong = usePlayerStore(s => s.currentSong);
  const setQueue    = usePlayerStore(s => s.setQueue);
  const user        = useAuthStore(s => s.user);
  const { songs }   = useAllSongs();

  const listenStartRef = useRef<number | null>(null);
  const isPlayingRef   = useRef(false);
  const profileRef     = useRef<UserTasteProfile | null>(null);

  // ── Load user profile ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'userProfiles', user.uid!));
        if (snap.exists()) profileRef.current = snap.data() as UserTasteProfile;
      } catch (_) {}
    };

    void load(); // ✅ void = intentionally not awaited at top level
  }, [user]);

  // ── Track playing state ────────────────────────────────
  useEffect(() => {
    return usePlayerStore.subscribe(state => {
      if (state.status === 'playing' && state.currentSong) {
        if (!isPlayingRef.current) {
          listenStartRef.current = Date.now();
          isPlayingRef.current   = true;
        }
      } else {
        isPlayingRef.current = false;
      }
    });
  }, []);

  // ── Log listen event ───────────────────────────────────
  const logListenEvent = useCallback(async (
    song: Song,
    action: ListenEvent['action'],
    songDurationMs: number,
  ): Promise<void> => {
    if (!user || listenStartRef.current === null) return;

    const durationMs  = Date.now() - listenStartRef.current;
    const listenRatio = Math.min(durationMs / Math.max(songDurationMs, 1), 1);

    const event: ListenEvent = {
      songId:        song.id,
      startedAt:     serverTimestamp() as any,
      durationMs,
      songDurationMs,
      listenRatio,
      action,
      context:       'recommendation',
      sessionId:     `${user.uid}-${Date.now()}`,
    };

    // ✅ async/await + try/catch — no floating promises
    try {
      if (user?.uid) {
        await addDoc(collection(db, 'userEvents', user.uid, 'events'), event);

        // Refresh profile cache after update
        const snap = await getDoc(doc(db, 'userProfiles', user.uid!));
        if (snap.exists()) profileRef.current = snap.data() as UserTasteProfile;
      }
    } catch (_) {}

  }, [user]);

  // ── Build smart queue when song changes ───────────────
  useEffect(() => {
    if (!currentSong || songs.length === 0) return;

    const profile: UserTasteProfile = profileRef.current ?? {
      userId:        user?.uid ?? 'anon',
      genreScores:   {},
      tagScores:     {},
      strongLikes:   [],
      softLikes:     [],
      skipped:       [],
      neverPlay:     [],
      discoveryRate: 0.3,
      updatedAt:     new Date() as any,
    };

    const trendingIds = new Set(
      [...songs]
        .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
        .slice(0, 200)
        .map(s => s.id),
    );

    const scored = buildSmartQueue(currentSong, songs, profile, trendingIds, 25);
    setQueue(scored.map(s => s.song));

  }, [currentSong?.id, songs, setQueue, user?.uid]);

  return { logListenEvent };
}