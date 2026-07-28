import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, orderBy, limit, where,
  getDocs, startAfter, getCountFromServer,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GENRES } from '../types';
import type { Song } from '../types';


const PAGE_SIZE = 60;

// The library now grows by hundreds of songs a day via automatic ingestion,
// so nothing here uses onSnapshot anymore — a live listener on a
// fast-growing/whole collection re-fires (and re-renders the feed) on every
// single write anywhere, which is what caused the scroll flicker. A plain
// fetch on mount is plenty fresh for a content feed.


// ── Home feed — paginated, fetched once per mount ─────────
export const useSongFeed = () => {
  const [songs,         setSongs        ] = useState<Song[]>([]);
  const [isLoading,     setIsLoading    ] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore,       setHasMore      ] = useState(true);

  const lastDocRef = useRef<QueryDocumentSnapshot | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const q = query(
      collection(db, 'songs'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );

    getDocs(q).then(snap => {
      if (cancelled) return;
      setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Song)));
      lastDocRef.current = snap.docs[snap.docs.length - 1];
      setHasMore(snap.docs.length >= PAGE_SIZE);
      setIsLoading(false);
    }).catch(err => {
      console.warn('[useSongFeed]', err.message);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !lastDocRef.current) return;

    setIsLoadingMore(true);
    try {
      const q = query(
        collection(db, 'songs'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const newSongs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Song));

      setSongs(prev => {
        const ids    = new Set(prev.map(s => s.id));
        const unique = newSongs.filter(s => !ids.has(s.id));
        return [...prev, ...unique];
      });

      if (snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMore(snap.docs.length >= PAGE_SIZE);
    } catch (err) {
      console.warn('[loadMore]', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore]);

  return { songs, isLoading, isLoadingMore, hasMore, loadMore };
};


// ── "All songs" — Search + genre browse + smart queue ──────
// Capped so payload/memory stay bounded no matter how big the library gets;
// newest-first keeps it representative of what's actually being added.
//
// Home, Search, and the player's smart-queue hook all call this — without a
// shared cache each one fires its own independent 4000-doc read, which is
// exactly the kind of read multiplication that burns through Firestore's
// daily free-tier quota. One fetch per page load, shared by everyone.
const ALL_SONGS_CAP = 4000;
let allSongsCache: Song[] | null = null;
let allSongsInFlight: Promise<Song[]> | null = null;

function fetchAllSongsOnce(): Promise<Song[]> {
  if (allSongsCache) return Promise.resolve(allSongsCache);
  if (allSongsInFlight) return allSongsInFlight;

  allSongsInFlight = getDocs(
    query(collection(db, 'songs'), orderBy('createdAt', 'desc'), limit(ALL_SONGS_CAP)),
  ).then(snap => {
    const songs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Song));
    allSongsCache = songs;
    allSongsInFlight = null;
    return songs;
  }).catch(err => {
    console.warn('[useAllSongs]', err);
    allSongsInFlight = null;
    return [];
  });

  return allSongsInFlight;
}

export const useAllSongs = () => {
  const [songs,     setSongs    ] = useState<Song[]>(allSongsCache ?? []);
  const [isLoading, setIsLoading] = useState(!allSongsCache);

  useEffect(() => {
    if (allSongsCache) return; // already have it, nothing to do
    let cancelled = false;
    fetchAllSongsOnce().then(s => {
      if (!cancelled) { setSongs(s); setIsLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  return { songs, isLoading };
};


// ── Per-genre song counts — server-side aggregation, no documents ──
// transferred at all, so this stays cheap and accurate regardless of the
// ALL_SONGS_CAP above or how large the library grows. Also shared/cached —
// same reasoning as useAllSongs above.
let genreCountsCache: Record<string, number> | null = null;
let genreCountsInFlight: Promise<Record<string, number>> | null = null;

function fetchGenreCountsOnce(): Promise<Record<string, number>> {
  if (genreCountsCache) return Promise.resolve(genreCountsCache);
  if (genreCountsInFlight) return genreCountsInFlight;

  genreCountsInFlight = Promise.all(
    GENRES.map(async g => {
      const snap = await getCountFromServer(
        query(collection(db, 'songs'), where('tags', 'array-contains', g.id)),
      );
      return [g.id, snap.data().count] as const;
    }),
  ).then(pairs => {
    const counts = Object.fromEntries(pairs);
    genreCountsCache = counts;
    genreCountsInFlight = null;
    return counts;
  }).catch(err => {
    console.warn('[useGenreCounts]', err);
    genreCountsInFlight = null;
    return {};
  });

  return genreCountsInFlight;
}

export const useGenreCounts = () => {
  const [counts,    setCounts   ] = useState<Record<string, number>>(genreCountsCache ?? {});
  const [isLoading, setIsLoading] = useState(!genreCountsCache);

  useEffect(() => {
    if (genreCountsCache) return;
    let cancelled = false;
    fetchGenreCountsOnce().then(c => {
      if (!cancelled) { setCounts(c); setIsLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  return { counts, isLoading };
};
