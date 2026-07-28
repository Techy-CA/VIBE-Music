import { create } from 'zustand';
import {
  collection, addDoc, serverTimestamp,
  query, where, getDocs, deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Song } from '../types';

type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerState {
  currentSong:       Song | null;
  status:            Status;
  volume:            number;
  isMuted:           boolean;
  currentTime:       number;
  duration:          number;
  queue:             Song[];
  queueVisible:      boolean;
  categoryPool:      Song[];

  // ✅ Crossfade state
  preloadedSong:     Song | null;
  crossfadeProgress: number;

  seekFn: ((seconds: number) => void) | null;

  play:             (song: Song, pool?: Song[], userId?: string) => void;
  pause:            () => void;
  resume:           () => void;
  setStatus:        (s: Status) => void;
  setVolume:        (v: number) => void;
  toggleMute:       () => void;
  setCurrentTime:   (t: number) => void;
  setDuration:      (d: number) => void;
  playNext:         () => void;
  addToQueue:       (song: Song) => void;
  removeFromQueue:  (id: string) => void;
  clearQueue:       () => void;
  toggleQueue:      () => void;
  setCategoryPool:  (songs: Song[]) => void;
  setSeekFn:        (fn: (seconds: number) => void) => void;
  registerSeekFn:   (fn: (seconds: number) => void) => void;
  setQueue:         (songs: Song[]) => void;

  // ✅ CrossfadeEngine actions
  setPreloadedSong:     (song: Song | null) => void;
  setCrossfadeProgress: (n: number) => void;
  setCurrentSongSilent: (song: Song, userId?: string) => void;
  dequeueFirst:         () => void;
}

// ── Write to Firestore history (for usePersonalizedFeed) ──
// Keeps only the latest 50 entries per user to avoid bloat
async function writeHistory(userId: string, song: Song) {
  try {
    // Add new entry
    await addDoc(collection(db, 'history'), {
      userId,
      songId:   song.id,
      title:    song.title,
      playedAt: serverTimestamp(),
    });

    // Prune: keep only latest 50 — delete oldest beyond that
    const snap = await getDocs(
      query(collection(db, 'history'), where('userId', '==', userId))
    );
    if (snap.size > 50) {
      const sorted = snap.docs
        .sort((a, b) => {
          const aT = a.data().playedAt?.toMillis?.() ?? 0;
          const bT = b.data().playedAt?.toMillis?.() ?? 0;
          return aT - bT; // oldest first
        });
      const toDelete = sorted.slice(0, snap.size - 50);
      await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
    }
  } catch (err) {
    // Non-critical — silently ignore
    console.warn('[History] write failed:', err);
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong:       null,
  status:            'idle',
  volume:            80,
  isMuted:           false,
  currentTime:       0,
  duration:          0,
  queue:             [],
  queueVisible:      false,
  categoryPool:      [],
  seekFn:            null,
  preloadedSong:     null,
  crossfadeProgress: 0,

  // ── Playback ───────────────────────────────────────────
  play: (song, pool, userId) => {
    set(s => ({
      currentSong:       song,
      status:            'loading',
      currentTime:       0,
      duration:          0,
      categoryPool:      pool ?? s.categoryPool,
      preloadedSong:     null,
      crossfadeProgress: 0,
    }));
    // ✅ Write to Firestore history so personalized feed learns taste
    if (userId) void writeHistory(userId, song);
  },

  pause:          () => set({ status: 'paused' }),
  resume:         () => set({ status: 'playing' }),
  setStatus:      (status) => set({ status }),
  setVolume:      (volume) => set({ volume, isMuted: false }),
  toggleMute:     () => set(s => ({ isMuted: !s.isMuted })),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration:    (duration) => set({ duration }),
  toggleQueue:    () => set(s => ({ queueVisible: !s.queueVisible })),
  setCategoryPool:(songs) => set({ categoryPool: songs }),

  // ── Seek fn (two names, same thing) ──────────────────
  setSeekFn:      (fn) => set({ seekFn: fn }),
  registerSeekFn: (fn) => set({ seekFn: fn }),

  setQueue: (songs) => set({ categoryPool: songs }),

  addToQueue: (song) => set(s => {
    if (s.queue.find(q => q.id === song.id)) return s;
    return { queue: [...s.queue, song] };
  }),

  removeFromQueue: (id) => set(s => ({
    queue: s.queue.filter(q => q.id !== id),
  })),

  clearQueue: () => set({ queue: [] }),

  // ── playNext (manual skip — bypasses crossfade) ───────
  playNext: () => {
    const { queue, currentSong, categoryPool } = get();

    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({
        currentSong:       next,
        status:            'loading',
        currentTime:       0,
        duration:          0,
        queue:             rest,
        preloadedSong:     null,
        crossfadeProgress: 0,
      });
      return;
    }

    if (categoryPool.length > 0 && currentSong) {
      const idx = categoryPool.findIndex(s => s.id === currentSong.id);
      // Smart-queue pools deliberately exclude the seed song, so idx is -1
      // there — the top-scored recommendation (index 0) IS the next song.
      // A raw, non-scored pool (before the smart queue kicks in) still has
      // the seed in it, so advance sequentially instead.
      const next = idx === -1 ? categoryPool[0] : categoryPool[(idx + 1) % categoryPool.length];
      if (next && next.id !== currentSong.id) {
        set({
          currentSong:       next,
          status:            'loading',
          currentTime:       0,
          duration:          0,
          preloadedSong:     null,
          crossfadeProgress: 0,
        });
      }
    }
  },

  // ── CrossfadeEngine actions ───────────────────────────
  setPreloadedSong:     (song) => set({ preloadedSong: song }),
  setCrossfadeProgress: (n)    => set({ crossfadeProgress: n }),

  // Advance currentSong after crossfade WITHOUT reloading the video
  setCurrentSongSilent: (song, userId) => {
    set({
      currentSong:       song,
      currentTime:       0,
      preloadedSong:     null,
      crossfadeProgress: 0,
      // status stays 'playing' — video already running
    });
    // ✅ Also track crossfade-advanced songs in history
    if (userId) void writeHistory(userId, song);
  },

  dequeueFirst: () => set(s => ({
    queue: s.queue.slice(1),
  })),
}));