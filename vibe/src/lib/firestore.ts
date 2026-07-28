import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  startAfter, onSnapshot, increment, setDoc,
  serverTimestamp, arrayUnion, arrayRemove,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Song, UserProfile, Like, Playlist } from '../types';

// ── Users ──────────────────────────────────────────────────
export const createUserProfile = (uid: string, data: Partial<UserProfile>) =>
  setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() }, { merge: true });

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
};

// ── Songs ──────────────────────────────────────────────────
export const addSong = (data: Omit<Song, 'id' | 'createdAt' | 'likeCount'>) =>
  addDoc(collection(db, 'songs'), { ...data, likeCount: 0, createdAt: serverTimestamp() });

export const getSongsPage = async (lastDoc?: QueryDocumentSnapshot, pageSize = 12) => {
  const constraints = lastDoc
    ? [orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize)]
    : [orderBy('createdAt', 'desc'), limit(pageSize)];
  const snap = await getDocs(query(collection(db, 'songs'), ...constraints));
  return {
    songs:   snap.docs.map(d => ({ id: d.id, ...d.data() } as Song)),
    lastDoc: snap.docs[snap.docs.length - 1],
    hasMore: snap.docs.length === pageSize,
  };
};

export const getSongsByUser = async (userId: string): Promise<Song[]> => {
  const q    = query(collection(db, 'songs'), where('addedBy', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Song))
    .sort((a, b) => {
      const aT = (a.createdAt as any)?.seconds ?? 0;
      const bT = (b.createdAt as any)?.seconds ?? 0;
      return bT - aT;
    });
};

export const getSongsByIds = async (ids: string[]): Promise<Song[]> => {
  if (!ids.length) return [];
  const songs: Song[] = [];
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'songs', id));
    if (snap.exists()) songs.push({ id: snap.id, ...snap.data() } as Song);
  }
  return songs;
};

// ── Home feed — limited real-time (20 songs) ──────────────
export const subscribeSongs = (cb: (songs: Song[]) => void, pageSize = 20) =>
  onSnapshot(
    query(collection(db, 'songs'), orderBy('createdAt', 'desc'), limit(pageSize)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Song))),
    err  => console.warn('[subscribeSongs]', err.message),
  );

// ✅ NEW — Full collection, no limit (Search + genre counts + playlist resolve)
export const subscribeAllSongs = (cb: (songs: Song[]) => void) =>
  onSnapshot(
    query(collection(db, 'songs'), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Song))),
    err  => {
      console.warn('[subscribeAllSongs]', err.message);
      cb([]);
    },
  );

// ── Likes ──────────────────────────────────────────────────
const likeId = (uid: string, sid: string) => `${uid}_${sid}`;

export const toggleLike = async (uid: string, songId: string, isLiked: boolean) => {
  const likeRef = doc(db, 'likes', likeId(uid, songId));
  const songRef = doc(db, 'songs', songId);
  if (isLiked) {
    await deleteDoc(likeRef);
    await updateDoc(songRef, { likeCount: increment(-1) });
  } else {
    await setDoc(likeRef, { userId: uid, songId, createdAt: serverTimestamp() });
    await updateDoc(songRef, { likeCount: increment(1) });
  }
};

export const subscribeUserLikes = (uid: string, cb: (ids: string[]) => void) =>
  onSnapshot(
    query(collection(db, 'likes'), where('userId', '==', uid)),
    snap => cb(snap.docs.map(d => (d.data() as Like).songId)),
  );

// ── Playlists ──────────────────────────────────────────────
export const createPlaylist = (data: Omit<Playlist, 'id' | 'createdAt'>) =>
  addDoc(collection(db, 'playlists'), { ...data, createdAt: serverTimestamp() });

export const getUserPlaylists = async (userId: string): Promise<Playlist[]> => {
  const q    = query(collection(db, 'playlists'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Playlist))
    .sort((a, b) => {
      const aT = (a.createdAt as any)?.seconds ?? 0;
      const bT = (b.createdAt as any)?.seconds ?? 0;
      return bT - aT;
    });
};

export const subscribeUserPlaylists = (uid: string, cb: (playlists: Playlist[]) => void) =>
  onSnapshot(
    query(collection(db, 'playlists'), where('userId', '==', uid)),
    snap => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Playlist))
        .sort((a, b) => {
          const aT = (a.createdAt as any)?.seconds ?? 0;
          const bT = (b.createdAt as any)?.seconds ?? 0;
          return bT - aT;
        });
      cb(sorted);
    },
  );

export const getPlaylist = async (id: string): Promise<Playlist | null> => {
  const snap = await getDoc(doc(db, 'playlists', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Playlist) : null;
};

export const addSongToPlaylist = (playlistId: string, songId: string, thumbnail: string) =>
  updateDoc(doc(db, 'playlists', playlistId), {
    songIds:        arrayUnion(songId),
    coverThumbnail: thumbnail,
    updatedAt:      serverTimestamp(),
  });

export const removeSongFromPlaylist = (playlistId: string, songId: string) =>
  updateDoc(doc(db, 'playlists', playlistId), {
    songIds:   arrayRemove(songId),
    updatedAt: serverTimestamp(),
  });

export const updatePlaylistMeta = (
  playlistId: string,
  data: { name: string; description?: string },
) =>
  updateDoc(doc(db, 'playlists', playlistId), {
    name:        data.name.trim(),
    description: (data.description ?? '').trim(),
    updatedAt:   serverTimestamp(),
  });

export const deletePlaylist = (playlistId: string) =>
  deleteDoc(doc(db, 'playlists', playlistId));

export { updateDoc, doc };