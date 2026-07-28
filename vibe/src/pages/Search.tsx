import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Heart, SlidersHorizontal, Check, ListPlus } from 'lucide-react';
import { usePlayerStore }    from '../store/usePlayerStore';
import { useAuthStore }      from '../store/useAuthStore';
import { useLikes }          from '../hooks/useLikes';
import { useAllSongs }       from '../hooks/useSongs';
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


// ── Tooltip ────────────────────────────────────────────────
const Tooltip = ({ text }: { text: string }) => (
  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-zinc-800 border border-white/10 text-[11px] text-zinc-200 whitespace-nowrap pointer-events-none z-50 shadow-lg">
    {text}
    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-800" />
  </div>
);


// ── Song Row ───────────────────────────────────────────────
const SearchRow = ({ song, pool, onPlay }: { song: Song; pool: Song[]; onPlay: (s: Song, pool: Song[]) => void }) => {
  const { currentSong, status, addToQueue } = usePlayerStore();
  const { likedIds, handleToggle } = useLikes();
  const user      = useAuthStore(s => s.user);
  const isActive  = currentSong?.id === song.id;
  const isPlaying = isActive && status === 'playing';
  const isLiked   = likedIds.has(song.id);

  const [showLikeTooltip,  setShowLikeTooltip ] = useState(false);
  const [showQueueTooltip, setShowQueueTooltip] = useState(false);
  const [queueAdded,       setQueueAdded      ] = useState(false);

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(song);
    setQueueAdded(true);
    setTimeout(() => setQueueAdded(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onClick={() => onPlay(song, pool)}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group border select-none',
        isActive
          ? 'bg-white/7 border-white/8'
          : 'hover:bg-white/4 border-transparent hover:border-white/6',
      )}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        <img src={song.thumbnail} alt={song.title}
          className={cn('w-10 h-10 rounded-lg object-cover', isActive && 'ring-1 ring-violet-500/60')} />
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
            <EqBars />
          </div>
        )}
      </div>

      {/* Info — sirf title, kuch aur nahi */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] font-medium truncate transition-colors',
          isActive ? 'text-violet-300' : 'text-zinc-200 group-hover:text-white',
        )}>
          {song.title}
        </p>
      </div>

      {/* Actions — hover pe dikhte hain */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* Add to Queue */}
        <div className="relative"
          onMouseEnter={() => setShowQueueTooltip(true)}
          onMouseLeave={() => setShowQueueTooltip(false)}
        >
          {showQueueTooltip && <Tooltip text={queueAdded ? 'Added!' : 'Add to queue'} />}
          <button
            onClick={handleAddToQueue}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100',
              queueAdded
                ? 'text-violet-400 bg-violet-500/10'
                : 'text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10',
            )}
          >
            <ListPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Like */}
        {user && (
          <div className="relative"
            onMouseEnter={() => setShowLikeTooltip(true)}
            onMouseLeave={() => setShowLikeTooltip(false)}
          >
            {showLikeTooltip && <Tooltip text={isLiked ? 'Unlike' : 'Like'} />}
            <button
              onClick={e => { e.stopPropagation(); handleToggle(song.id); }}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100',
                isLiked
                  ? 'text-pink-500 opacity-100'
                  : 'text-zinc-500 hover:text-pink-400 hover:bg-pink-500/10',
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', isLiked && 'fill-pink-500')} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};


// ── Genre Card ─────────────────────────────────────────────
const GenreCard = ({
  genre, count, index, onClick,
}: {
  genre: typeof GENRES[number];
  count: number;
  index: number;
  onClick: () => void;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(index * 0.03, 0.25) }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{ WebkitTapHighlightColor: 'transparent' }}
    className="relative rounded-xl bg-zinc-900/60 border border-white/[0.07] p-4 text-left hover:bg-zinc-800/60 hover:border-white/12 active:bg-zinc-700/60 transition-all duration-150 group overflow-hidden"
  >
    <div className="absolute right-3 top-3 text-2xl opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none">
      {genre.emoji}
    </div>
    <p className="text-[13px] font-semibold text-zinc-200 group-hover:text-white transition-colors">
      {genre.label}
    </p>
    <p className="text-[11px] text-zinc-600 mt-0.5">
      {count} song{count !== 1 ? 's' : ''}
    </p>
  </motion.button>
);


// ── Page ───────────────────────────────────────────────────
export default function SearchPage() {
  const { songs, isLoading } = useAllSongs();
  const { play, setCategoryPool } = usePlayerStore();
  const { addRecent }        = useRecentlyPlayed();

  const [query,      setQuery     ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selGenres,  setSelGenres ] = useState<string[]>([]);
  const [sortBy,     setSortBy    ] = useState<'relevance' | 'likes' | 'recent'>('relevance');
  const [showFilter, setShowFilter] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  const handlePlay = (song: Song, pool: Song[]) => {
    play(song, pool);
    setCategoryPool(pool);
    addRecent(song);
  };

  const toggleGenre = (id: string) =>
    setSelGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    songs.forEach(song => {
      (song.tags ?? []).forEach(tag => {
        counts[tag] = (counts[tag] ?? 0) + 1;
      });
    });
    return counts;
  }, [songs]);

  const results = useMemo(() => {
    return songs
      .filter(s => {
        const q = debouncedQ.toLowerCase().trim();
        const matchQ = !q ||
          s.title.toLowerCase().includes(q) ||
          s.addedByName?.toLowerCase().includes(q) ||
          s.tags?.some(t =>
            t.includes(q) ||
            GENRES.find(g => g.id === t)?.label.toLowerCase().includes(q)
          );
        const matchG = selGenres.length === 0 || selGenres.some(g => s.tags?.includes(g));
        return matchQ && matchG;
      })
      .sort((a, b) => {
        if (sortBy === 'likes')  return b.likeCount - a.likeCount;
        if (sortBy === 'recent') return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
        const q = debouncedQ.toLowerCase();
        if (!q) return b.likeCount - a.likeCount;
        const score = (s: Song) =>
          s.title.toLowerCase().startsWith(q) ? 3 :
          s.title.toLowerCase().includes(q)   ? 2 :
          s.addedByName?.toLowerCase().includes(q) ? 1 : 0;
        return score(b) - score(a) || b.likeCount - a.likeCount;
      });
  }, [songs, debouncedQ, selGenres, sortBy]);

  const hasFilter  = selGenres.length > 0 || sortBy !== 'relevance';
  const showBrowse = !debouncedQ && selGenres.length === 0;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-[20px] font-bold text-white tracking-tight mb-4">Search</h1>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Songs, artists, genres..."
              className="w-full h-10 bg-zinc-900 border border-white/8 rounded-xl pl-9 pr-9 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:bg-zinc-800 transition-all"
            />
            <AnimatePresence>
              {query && (
                <motion.button
  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8 }}
  onClick={() => { setQuery(''); setDebouncedQ(''); }}
  className="absolute right-3 top-0 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors"
>
  <X className="w-3.5 h-3.5" />
</motion.button>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setShowFilter(p => !p)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={cn(
              'h-10 px-3 rounded-xl border text-[13px] font-medium flex items-center gap-2 transition-all flex-shrink-0',
              showFilter || hasFilter
                ? 'bg-violet-600/15 border-violet-500/30 text-violet-300'
                : 'bg-white/5 border-white/8 text-zinc-500 hover:text-zinc-300 hover:bg-white/8',
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilter && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
          </button>
        </div>

        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2">Sort By</p>
                  <div className="flex gap-2 flex-wrap">
                    {([
                      { id: 'relevance', label: 'Relevance' },
                      { id: 'likes',     label: 'Most Liked' },
                      { id: 'recent',    label: 'Newest' },
                    ] as const).map(opt => (
                      <button key={opt.id} onClick={() => setSortBy(opt.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all',
                          sortBy === opt.id
                            ? 'bg-white/10 border-white/15 text-white'
                            : 'bg-white/4 border-white/[0.07] text-zinc-500 hover:text-zinc-300',
                        )}>
                        {sortBy === opt.id && <Check className="w-3 h-3" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.08em] mb-2">Genre</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {GENRES.map(g => {
                      const active = selGenres.includes(g.id);
                      return (
                        <button key={g.id} onClick={() => toggleGenre(g.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-all',
                            active
                              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                              : 'bg-white/4 border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:bg-white/6',
                          )}>
                          {active && <Check className="w-2.5 h-2.5" />}
                          {g.emoji} {g.label}
                          <span className="text-[10px] text-zinc-700 ml-0.5">
                            {genreCounts[g.id] ?? 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasFilter && (
                  <button
                    onClick={() => { setSelGenres([]); setSortBy('relevance'); }}
                    className="text-[12px] text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[60px] bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>

      ) : showBrowse ? (
        <div>
          <p className="text-[12px] text-zinc-500 mb-4">
            Browse by genre
            <span className="text-zinc-700 ml-2">({songs.length} total songs)</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {GENRES.map((g, i) => (
              <GenreCard
                key={g.id}
                genre={g}
                count={genreCounts[g.id] ?? 0}
                index={i}
                onClick={() => { setSelGenres([g.id]); setShowFilter(false); }}
              />
            ))}
          </div>
        </div>

      ) : results.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/4 border border-dashed border-white/8 flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-zinc-700" />
          </div>
          <p className="text-[13px] font-medium text-zinc-500">No results found</p>
          <p className="text-[12px] text-zinc-700 mt-1">Try different keywords or filters</p>
          {hasFilter && (
            <button
              onClick={() => { setSelGenres([]); setSortBy('relevance'); }}
              className="mt-3 text-[12px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </motion.div>

      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-[12px] text-zinc-600 mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''}
            {debouncedQ && <> for "<span className="text-zinc-400">{debouncedQ}</span>"</>}
            {selGenres.length > 0 && (
              <span className="text-zinc-600">
                {' '}in {selGenres.map(id => GENRES.find(g => g.id === id)?.label).join(', ')}
              </span>
            )}
          </p>
          <AnimatePresence mode="popLayout">
            <div className="space-y-0.5">
              {results.map(song => (
                <SearchRow key={song.id} song={song} pool={results} onPlay={handlePlay} />
              ))}
            </div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}