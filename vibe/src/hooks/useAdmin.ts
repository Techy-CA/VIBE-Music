import { useCallback } from 'react';
import {
  doc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { ADMIN_EMAIL } from '../types';
import type { Song } from '../types';

export const useAdmin = () => {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const deleteSong = useCallback(async (songId: string) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, 'songs', songId));
  }, [isAdmin]);

  const updateSong = useCallback(async (songId: string, data: Partial<Song>) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'songs', songId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, [isAdmin]);

  return { isAdmin, deleteSong, updateSong };
};