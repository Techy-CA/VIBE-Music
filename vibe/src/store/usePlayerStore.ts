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
  recentSongIds:     string[]; // last few played — keeps next-song picks out of tight loops

  // ✅ Crossfade state
  preloadedSong:     Song | null;
  crossfadeProgress: number;
  crossfadeEnabled:  boolean;

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
  peekNext:         () => Song | null;
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
  setCrossfadeEnabled:  (enabled: boolean) => void;
  setCurrentSongSilent: (song: Song, userId?: string) => void;
  advanceToNext:        (song: Song, userId?: string) => void;
  dequeueFirst:         () => void;
}

const CROSSFADE_PREF_KEY = 'zuno_crossfade_enabled';

function loadCrossfadePref(): boolean {
  try {
    const raw = localStorage.getItem(CROSSFADE_PREF_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

// How many of the top-scored candidates to randomize among when picking the
// next song. Always taking #1 sounds "smart" but two or three songs that
// mutually out-score everything else for each other (identical tag sets)
// turns into a permanent ping-pong loop between them — this breaks that
// while staying within the genre-matched top of the pool.
const NEXT_SONG_RANDOM_WINDOW = 5;
const RECENT_HISTORY_LIMIT    = 6;

// Shared "what would play next" logic — used by both the hard-cut playNext()
// and peekNext() (read-only, so the crossfade engine can preload it early).
function computeNext(state: PlayerState): { song: Song; fromQueue: boolean } | null {
  if (state.queue.length > 0) return { song: state.queue[0], fromQueue: true };

  const { currentSong, categoryPool, recentSongIds } = state;
  if (categoryPool.length > 0 && currentSong) {
    const idx = categoryPool.findIndex(s => s.id === currentSong.id);

    if (idx === -1) {
      // Smart-queue pools deliberately exclude the seed song — pick randomly
      // among the top few matches instead of always #1, and prefer one that
      // hasn't played recently so a tight mutual-top-pick pair can't loop.
      const window = categoryPool.slice(0, NEXT_SONG_RANDOM_WINDOW);
      const fresh  = window.filter(s => !recentSongIds.includes(s.id));
      const pool   = fresh.length > 0 ? fresh : window;
      const next   = pool[Math.floor(Math.random() * pool.length)];
      if (next) return { song: next, fromQueue: false };
    } else {
      // A raw, non-scored pool (before the smart queue kicks in) still has
      // the seed in it — advance sequentially instead.
      const next = categoryPool[(idx + 1) % categoryPool.length];
      if (next && next.id !== currentSong.id) return { song: next, fromQueue: false };
    }
  }
  return null;
}

function pushRecent(recentSongIds: string[], id: string | undefined): string[] {
  if (!id) return recentSongIds;
  return [id, ...recentSongIds.filter(x => x !== id)].slice(0, RECENT_HISTORY_LIMIT);
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
  recentSongIds:     [],
  seekFn:            null,
  preloadedSong:     null,
  crossfadeProgress: 0,
  crossfadeEnabled:  loadCrossfadePref(),

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
      recentSongIds:     pushRecent(s.recentSongIds, s.currentSong?.id),
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

  // ── playNext (manual skip / natural end — hard cut) ───
  playNext: () => {
    const next = computeNext(get());
    if (!next) return;
    set(s => ({
      currentSong:       next.song,
      status:            'loading',
      currentTime:       0,
      duration:          0,
      queue:             next.fromQueue ? s.queue.slice(1) : s.queue,
      preloadedSong:     null,
      crossfadeProgress: 0,
      recentSongIds:     pushRecent(s.recentSongIds, s.currentSong?.id),
    }));
  },

  // Read-only — what WOULD play next, without changing any state. Lets the
  // crossfade engine know what to preload ahead of time.
  peekNext: () => computeNext(get())?.song ?? null,

  // ── CrossfadeEngine actions ───────────────────────────
  setPreloadedSong:     (song) => set({ preloadedSong: song }),
  setCrossfadeProgress: (n)    => set({ crossfadeProgress: n }),
  setCrossfadeEnabled:  (enabled) => {
    try { localStorage.setItem(CROSSFADE_PREF_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
    set({ crossfadeEnabled: enabled });
  },

  // Advance currentSong after crossfade WITHOUT reloading the video
  setCurrentSongSilent: (song, userId) => {
    set(s => ({
      currentSong:       song,
      currentTime:       0,
      preloadedSong:     null,
      crossfadeProgress: 0,
      recentSongIds:     pushRecent(s.recentSongIds, s.currentSong?.id),
      // status stays 'playing' — video already running
    }));
    // ✅ Also track crossfade-advanced songs in history
    if (userId) void writeHistory(userId, song);
  },

  // Same as setCurrentSongSilent, but also pops the manual queue if that's
  // where the song came from — used when a crossfade finishes into it.
  advanceToNext: (song, userId) => {
    set(s => ({
      currentSong:       song,
      currentTime:       0,
      preloadedSong:     null,
      crossfadeProgress: 0,
      queue:             s.queue[0]?.id === song.id ? s.queue.slice(1) : s.queue,
      recentSongIds:     pushRecent(s.recentSongIds, s.currentSong?.id),
    }));
    if (userId) void writeHistory(userId, song);
  },

  dequeueFirst: () => set(s => ({
    queue: s.queue.slice(1),
  })),
}));