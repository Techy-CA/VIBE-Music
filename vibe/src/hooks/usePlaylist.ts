import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, arrayUnion, arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db }           from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import type { Playlist } from '../types';

export const usePlaylists = () => {
  const user = useAuthStore(s => s.user);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const uid = user?.uid ?? user?.id;

  useEffect(() => {
    if (!uid) {
      setPlaylists([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'playlists'),
      where('userId', '==', uid),
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist));
        data.sort((a, b) => {
          const aTime = a.createdAt?.seconds ?? 0;
          const bTime = b.createdAt?.seconds ?? 0;
          return bTime - aTime;
        });
        setPlaylists(data);
        setIsLoading(false);
      },
      err => {
        console.warn('[usePlaylists] error:', err.message);
        setPlaylists([]);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  const createPlaylist = useCallback(async (name: string, description = '') => {
    if (!uid) {
      console.warn('[usePlaylists] createPlaylist: no uid');
      return null;
    }
    try {
      const ref = await addDoc(collection(db, 'playlists'), {
        name:        name.trim(),
        description: description.trim(),
        userId:      uid,
        songIds:     [],
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      return ref.id;
    } catch (e) {
      console.error('[usePlaylists] createPlaylist failed:', e);
      return null;
    }
  }, [uid]);

  const deletePlaylist = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'playlists', id));
    } catch (e) {
      console.error('[usePlaylists] deletePlaylist failed:', e);
    }
  }, []);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, 'playlists', id), {
        name:      name.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[usePlaylists] renamePlaylist failed:', e);
    }
  }, []);

  // ✅ updatePlaylist — name + description dono update karta hai
  const updatePlaylist = useCallback(async (
    id: string,
    data: { name: string; description?: string },
  ) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'playlists', id), {
        name:        data.name.trim(),
        description: (data.description ?? '').trim(),
        updatedAt:   serverTimestamp(),
      });
    } catch (e) {
      console.error('[usePlaylists] updatePlaylist failed:', e);
    }
  }, [uid]);

  const addSongToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    try {
      await updateDoc(doc(db, 'playlists', playlistId), {
        songIds:   arrayUnion(songId),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[usePlaylists] addSong failed:', e);
    }
  }, []);

  const removeSongFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    try {
      await updateDoc(doc(db, 'playlists', playlistId), {
        songIds:   arrayRemove(songId),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[usePlaylists] removeSong failed:', e);
    }
  }, []);

  return {
    playlists,
    isLoading,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    updatePlaylist,         // ✅ newly added
    addSongToPlaylist,
    removeSongFromPlaylist,
  };
};