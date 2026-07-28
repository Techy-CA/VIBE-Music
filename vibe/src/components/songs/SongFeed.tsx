import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Music2 } from 'lucide-react';
import { SongCard } from './SongCard';
import { SongCardSkeleton } from '../ui/Skeleton';
import { useSongFeed } from '../../hooks/useSongs';

export const SongFeed = () => {
  const { songs, isLoading, isLoadingMore, hasMore, loadMore } = useSongFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => <SongCardSkeleton key={i} />)}
    </div>
  );

  if (!songs.length) return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-3xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-5">
        <Music2 className="w-9 h-9 text-purple-500/60" />
      </div>
      <h3 className="text-xl font-bold text-slate-100 mb-2">No songs yet</h3>
      <p className="text-slate-500 max-w-xs text-sm leading-relaxed">
        Be the first to add a song. Paste a YouTube link and share what you're vibing to.
      </p>
    </motion.div>
  );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {songs.map((song, i) => <SongCard key={song.id} song={song} index={i} />)}
        {isLoadingMore && Array.from({ length: 3 }).map((_, i) => <SongCardSkeleton key={`more-${i}`} />)}
      </div>
      <div ref={sentinelRef} className="h-10" />
      {!hasMore && songs.length > 0 && (
        <p className="text-center text-slate-600 text-sm py-8">You've reached the end 🎶</p>
      )}
    </>
  );
};