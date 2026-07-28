import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, orderBy, limit,
  onSnapshot, startAfter, getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Song } from '../types';


const PAGE_SIZE = 20;


// ── Home feed — paginated + real-time ─────────────────────
export const useSongFeed = () => {
  const [songs,         setSongs        ] = useState<Song[]>([]);
  const [isLoading,     setIsLoading    ] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore,       setHasMore      ] = useState(true);

  const lastDocRef = useRef<QueryDocumentSnapshot | undefined>(undefined);

  useEffect(() => {
    setIsLoading(true);

    const q = query(
      collection(db, 'songs'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );

    const unsub = onSnapshot(q, snap => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Song));
      setSongs(fetched);
      lastDocRef.current = snap.docs[snap.docs.length - 1];
      setHasMore(snap.docs.length >= PAGE_SIZE);
      setIsLoading(false);
    }, err => {
      console.warn('[useSongFeed]', err.message);
      setIsLoading(false);
    });

    return unsub;
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


// ── All songs — no limit (Search + genre counts) ──────────
export const useAllSongs = () => {
  const [songs,     setSongs    ] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Song)));
      setIsLoading(false);
    }, err => {
      console.warn('[useAllSongs]', err.message);
      setSongs([]);        // ✅ fixed — cb() hata diya
      setIsLoading(false);
    });
    return unsub;
  }, []);

  return { songs, isLoading };
};