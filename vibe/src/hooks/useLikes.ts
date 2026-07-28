import { useState, useEffect } from 'react';
import { subscribeUserLikes, toggleLike } from '../lib/firestore';
import { useAuthStore } from '../store/useAuthStore';

export const useLikes = () => {
  const { user } = useAuthStore();
  const [likedIds,   setLikedIds  ] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    return subscribeUserLikes(user.id, ids => setLikedIds(new Set(ids)));
  }, [user?.id]);

  const handleToggle = async (songId: string) => {
    if (!user || pendingIds.has(songId)) return;
    const isLiked = likedIds.has(songId);
    setPendingIds(p => new Set([...p, songId]));
    setLikedIds(p => {
      const next = new Set(p);
      isLiked ? next.delete(songId) : next.add(songId);
      return next;
    });
    try {
      await toggleLike(user.id, songId, isLiked);
    } catch {
      setLikedIds(p => {
        const next = new Set(p);
        isLiked ? next.add(songId) : next.delete(songId);
        return next;
      });
    } finally {
      setPendingIds(p => { const n = new Set(p); n.delete(songId); return n; });
    }
  };

  return { likedIds, handleToggle, pendingIds };
};