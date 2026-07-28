import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  limit, orderBy, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import type { Song } from '../types';

interface PersonalizedFeed {
  hero: Song | null;          // Trending/Hero card
  quickPlay: Song[];          // Quick Play row
  loading: boolean;
}

export const usePersonalizedFeed = (): PersonalizedFeed => {
  const user = useAuthStore(s => s.user);
  const [hero, setHero]           = useState<Song | null>(null);
  const [quickPlay, setQuickPlay] = useState<Song[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user || !user.uid) {
      fetchFallback();
      return;
    }
    fetchPersonalized(user.uid);
  }, [user?.uid]);

  // ── Personalized: based on likes + history ───────────────
  async function fetchPersonalized(uid: string) {
    setLoading(true);
    try {
      // 1. Get user's liked song IDs
      const likedSnap = await getDocs(
        query(collection(db, 'likes'), where('userId', '==', uid), limit(20))
      );
      const likedIds = likedSnap.docs.map(d => d.data().songId as string);

      // 2. Get user's recently played
      const historySnap = await getDocs(
        query(
          collection(db, 'history'),
          where('userId', '==', uid),
          orderBy('playedAt', 'desc'),
          limit(10),
        )
      );
      const historyIds = historySnap.docs.map(d => d.data().songId as string);

      // 3. Collect tags from liked + history songs
      const seedIds = [...new Set([...likedIds, ...historyIds])].slice(0, 8);
      const tags    = await collectTags(seedIds);

      if (tags.length === 0) {
        await fetchFallback();
        return;
      }

      // 4. Find songs matching those tags
      const matchSnap = await getDocs(
        query(
          collection(db, 'songs'),
          where('tags', 'array-contains-any', tags.slice(0, 10)),
          limit(40),
        )
      );

      const candidates = matchSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Song))
        .filter(s => !seedIds.includes(s.id)); // exclude already-known songs

      if (candidates.length === 0) {
        await fetchFallback();
        return;
      }

      // 5. Score by tag overlap + jitter
      const scored = candidates
        .map(s => ({
          s,
          score:
            (s.tags ?? []).filter(t => tags.includes(t)).length +
            Math.random() * 0.5,
        }))
        .sort((a, b) => b.score - a.score);

      const top = scored.map(x => x.s);

      // Hero = top pick, QuickPlay = next 6 (shuffled from top 12)
      setHero(top[0]);
      const pool = top.slice(1, 13);
      setQuickPlay(shuffle(pool).slice(0, 6));
    } catch (err) {
      console.error('[PersonalizedFeed]', err);
      await fetchFallback();
    } finally {
      setLoading(false);
    }
  }

  // ── Fallback: trending / random ──────────────────────────
  async function fetchFallback() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'songs'), orderBy('playCount', 'desc'), limit(20))
      );
      const songs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Song));
      if (songs.length === 0) return;
      setHero(songs[0]);
      setQuickPlay(shuffle(songs.slice(1)).slice(0, 6));
    } catch {
      // last resort: plain random
      try {
        const snap = await getDocs(query(collection(db, 'songs'), limit(20)));
        const songs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Song));
        setHero(songs[0] ?? null);
        setQuickPlay(songs.slice(1, 7));
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  // ── Collect tags from song IDs ───────────────────────────
  async function collectTags(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const fetches = ids.map(id => getDoc(doc(db, 'songs', id)));
    const docs    = await Promise.allSettled(fetches);
    const tagSet  = new Set<string>();
    docs.forEach(r => {
      if (r.status === 'fulfilled' && r.value.exists()) {
        (r.value.data()?.tags ?? []).forEach((t: string) => tagSet.add(t));
      }
    });
    return [...tagSet];
  }

  return { hero, quickPlay, loading };
};

// ── Fisher-Yates shuffle ─────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}