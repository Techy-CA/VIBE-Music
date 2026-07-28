import { useEffect, useState } from 'react';
import type { Song } from '../types';

const KEY = 'zuno_recently_played';
const MAX = 20;

export const useRecentlyPlayed = () => {
  const [recent, setRecent] = useState<Song[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch { return []; }
  });

  const addRecent = (song: Song) => {
    setRecent(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      const updated  = [song, ...filtered].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return { recent, addRecent };
};