import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Play } from 'lucide-react';
import { usePlayerStore }    from '../store/usePlayerStore';
import { useAuthStore }      from '../store/useAuthStore';
import { useLikes }          from '../hooks/useLikes';
import { useSongFeed }       from '../hooks/useSongs';
import { useRecentlyPlayed } from '../hooks/useRecentlyPlayed';
import { GENRES }            from '../types';
import { cn }                from '../utils/cn';
import type { Song }         from '../types';

const EqBars = () => (
  <div className="flex items-end gap-px h-3">
    {[2,3,2].map((h,i) => (
      <motion.span key={i} className="w-0.5 bg-violet-400 rounded-full"
        animate={{ height: [h, h+3, h] }}
        transition={{ repeat: Infinity, duration: 0.5, delay: i*0.1 }}
        style={{ height: h }} />
    ))}
  </div>
);

const SongCard = ({ song, index, onPlay }: {
  song: Song; index: number; onPlay: (s: Song) => void;
}) => {
  const { currentSong, status } = usePlayerStore();
  const { likedIds, handleToggle } = useLikes();
  const user     = useAuthStore(s => s.user);
  const isActive  = currentSong?.id === song.id;
  const isPlaying = isActive && status === 'playing';
  const isLiked   = likedIds.has(song.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => onPlay(song)}
      className={cn(
        'group cursor-pointer rounded-xl overflow-hidden border transition-all duration-150',
        isActive
          ? 'border-violet-500/30 bg-violet-500/5'
          : 'border-white/[0.06] hover:border-white/10 bg-zinc-900/40 hover:bg-zinc-900/70',
      )}
    >
      <div className="relative aspect-square overflow-hidden">
        <img src={song.thumbnail} alt={song.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className={cn(
          'absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}>
          <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            {isPlaying
              ? <EqBars />
              : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
          </div>
        </div>
        {/* Tags */}
        {song.tags && song.tags.length > 0 && (
          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
            {song.tags.slice(0,1).map(t => {
              const g = GENRES.find(g => g.id === t);
              return g ? (
                <span key={t} className="text-[10px] bg-black/60 backdrop-blur-sm text-zinc-300 px-1.5 py-0.5 rounded-md font-medium">
                  {g.label}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      <div className="p-2.5">
        <p className={cn(
          'text-[12.5px] font-medium truncate transition-colors',
          isActive ? 'text-violet-300' : 'text-zinc-200 group-hover:text-white',
        )}>
          {song.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-zinc-600 truncate flex-1">{song.addedByName}</p>
          {user && (
            <button
              onClick={e => { e.stopPropagation(); handleToggle(song.id); }}
              className={cn(
                'flex-shrink-0 ml-1 transition-colors',
                isLiked ? 'text-pink-500' : 'text-zinc-700 hover:text-pink-400',
              )}
            >
              <Heart className={cn('w-3 h-3', isLiked && 'fill-pink-500')} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const SECTION_LABELS: Record<string, string> = {
  trending:      'Trending',
  recent:        'Recently Added',
  picked:        'Picked For You',
  liked:         'Your Likes',
  jumpback:      'Jump Back In',
};

export default function SeeAll() {
  const { type }   = useParams<{ type: string }>();
  const navigate   = useNavigate();
  const { songs, isLoading } = useSongFeed();
  const { likedIds }         = useLikes();
  const { recent }           = useRecentlyPlayed();
  const { play }             = usePlayerStore();
  const { addRecent }        = useRecentlyPlayed();

  const handlePlay = (song: Song) => { play(song); addRecent(song); };

  const getSongs = (): Song[] => {
    switch (type) {
      case 'trending':   return [...songs].sort((a,b) => b.likeCount - a.likeCount);
      case 'recent':     return songs;
      case 'picked':     return songs.filter(s => !likedIds.has(s.id)).sort((a,b) => b.likeCount - a.likeCount);
      case 'liked':      return songs.filter(s => likedIds.has(s.id));
      case 'jumpback':   return recent;
      default:           return songs;
    }
  };

  const list  = getSongs();
  const label = SECTION_LABELS[type ?? ''] ?? 'All Songs';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-[20px] font-bold text-white tracking-tight">{label}</h1>
          <p className="text-[12px] text-zinc-500 mt-0.5">{list.length} songs</p>
        </div>
      </div>

      {/* Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square rounded-xl bg-white/5 animate-pulse" />
              <div className="h-2.5 bg-white/5 rounded mt-2 w-3/4 animate-pulse" />
              <div className="h-2 bg-white/5 rounded mt-1.5 w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/4 border border-dashed border-white/8 flex items-center justify-center mb-4">
            <Play className="w-6 h-6 text-zinc-700" />
          </div>
          <p className="text-[13px] font-medium text-zinc-500">Nothing here yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {list.map((song, i) => (
            <SongCard key={song.id} song={song} index={i} onPlay={handlePlay} />
          ))}
        </div>
      )}
    </motion.div>
  );
}