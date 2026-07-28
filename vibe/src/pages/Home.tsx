import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Clock, Sparkles, ChevronRight,
  Zap, Music2, History, Play, Plus, ChevronLeft, ListPlus,
} from 'lucide-react';
import { usePlayerStore }        from '../store/usePlayerStore';
import { useAuthStore }          from '../store/useAuthStore';
import { useLikes }              from '../hooks/useLikes';
import { useSongFeed, useAllSongs, useGenreCounts } from '../hooks/useSongs';
import { useRecentlyPlayed }     from '../hooks/useRecentlyPlayed';
import { usePersonalizedFeed }   from '../hooks/usePersonalizedFeed'; // ✅ NEW
import { shuffle }               from '../utils/shuffle';
import { GENRES }                from '../types';
import { cn }                    from '../utils/cn';
import { AddToPlaylistModal }    from '../components/playlist/AddToPlaylistModal';
import type { Song }             from '../types';

// ── Genre color map ────────────────────────────────────────
const GENRE_COLORS: Record<string, [string, string]> = {
  pop:        ['#e91e8c', '#9c27b0'],
  rock:       ['#c0392b', '#922b21'],
  hiphop:     ['#e67e22', '#d35400'],
  bollywood:  ['#8e44ad', '#6c3483'],
  punjabi:    ['#f39c12', '#e67e22'],
  classical:  ['#1a5276', '#154360'],
  jazz:       ['#117a65', '#0e6655'],
  edm:        ['#16a085', '#1abc9c'],
  sufi:       ['#6c3483', '#4a235a'],
  lofi:       ['#2471a3', '#1a5276'],
  devotional: ['#ca6f1e', '#a04000'],
  indie:      ['#1e8449', '#196f3d'],
};

// ── Equalizer ──────────────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-px h-3">
    {[2, 3, 2].map((h, i) => (
      <motion.span key={i} className="w-0.5 bg-violet-400 rounded-full"
        animate={{ height: [h, h + 3, h] }}
        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
        style={{ height: h }} />
    ))}
  </div>
);

// ── Mini Card ──────────────────────────────────────────────
const MiniCard = ({ song, index, onPlay, pool, onAddToPlaylist }: {
  song: Song; index: number;
  onPlay: (s: Song, pool: Song[]) => void;
  pool: Song[];
  onAddToPlaylist?: (s: Song) => void;
}) => {
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const addToQueue  = usePlayerStore(s => s.addToQueue);
  const user        = useAuthStore(s => s.user);
  const isActive    = currentSong?.id === song.id;
  const isPlaying   = isActive && status === 'playing';

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.2 }}
      onClick={() => onPlay(song, pool)}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPlay(song, pool)}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      className="flex-none w-[130px] sm:w-[144px] cursor-pointer group select-none"
    >
      <div className={cn(
        'relative aspect-square rounded-xl overflow-hidden bg-zinc-800',
        isActive && 'ring-2 ring-violet-500/50',
      )}>
        <img src={song.thumbnail} alt={song.title} draggable={false} loading="lazy" decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none" />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors pointer-events-none" />
        <div className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}>
          <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            {isPlaying ? <EqBars /> : <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />}
          </div>
        </div>
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={e => { e.stopPropagation(); addToQueue(song); }}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Add to queue"
            className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-zinc-300 hover:bg-black/80 transition-all"
          >
            <Plus className="w-3 h-3" />
          </button>
          {user && onAddToPlaylist && (
            <button
              onClick={e => { e.stopPropagation(); onAddToPlaylist(song); }}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              title="Add to playlist"
              className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-zinc-300 hover:bg-violet-500/80 transition-all"
            >
              <ListPlus className="w-3 h-3" />
            </button>
          )}
        </div>
        {song.tags?.[0] && (
          <div className="absolute bottom-1.5 left-1.5 pointer-events-none">
            <span className="text-[9.5px] bg-black/60 backdrop-blur-sm text-zinc-300 px-1.5 py-0.5 rounded-md font-medium">
              {GENRES.find(g => g.id === song.tags![0])?.label}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5 pointer-events-none">
        <p className={cn(
          'text-[12.5px] font-medium truncate leading-tight transition-colors',
          isActive ? 'text-violet-300' : 'text-zinc-200 group-hover:text-white',
        )}>{song.title}</p>
      </div>
    </motion.div>
  );
};

// ── Quick Row ──────────────────────────────────────────────
const QuickRow = ({ song, onPlay, pool, onAddToPlaylist }: {
  song: Song;
  onPlay: (s: Song, pool: Song[]) => void;
  pool: Song[];
  onAddToPlaylist?: (s: Song) => void;
}) => {
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const addToQueue  = usePlayerStore(s => s.addToQueue);
  const user        = useAuthStore(s => s.user);
  const isActive    = currentSong?.id === song.id;
  const isPlaying   = isActive && status === 'playing';

  return (
    <div
      onClick={() => onPlay(song, pool)}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPlay(song, pool)}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-3 cursor-pointer transition-all duration-150 group border select-none',
        isActive ? 'bg-white/7 border-white/8' : 'hover:bg-white/4 active:bg-white/6 border-transparent',
      )}
    >
      <img src={song.thumbnail} alt={song.title} draggable={false} loading="lazy" decoding="async"
        className={cn('w-10 h-10 rounded-lg object-cover flex-shrink-0 pointer-events-none',
          isActive && 'ring-1 ring-violet-500/50')} />
      <div className="flex-1 min-w-0 pointer-events-none">
        <p className={cn(
          'text-[13px] sm:text-[12.5px] font-medium truncate transition-colors',
          isActive ? 'text-violet-300' : 'text-zinc-200 group-hover:text-white',
        )}>{song.title}</p>
        {song.tags?.[0] && (
          <p className="text-[10.5px] text-zinc-600 mt-0.5">
            {song.tags.slice(0, 2).map(t => GENRES.find(g => g.id === t)?.label).filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); addToQueue(song); }}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          title="Add to queue"
          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/8 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {user && onAddToPlaylist && (
          <button
            onClick={e => { e.stopPropagation(); onAddToPlaylist(song); }}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            title="Add to playlist"
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
          >
            <ListPlus className="w-3.5 h-3.5" />
          </button>
        )}
        <div className={cn('pointer-events-none transition-all',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
          {isPlaying ? <EqBars /> : <Play className="w-3.5 h-3.5 text-zinc-400 fill-zinc-400" />}
        </div>
      </div>
    </div>
  );
};

// ── Section wrapper ────────────────────────────────────────
const HSection = ({ title, icon: Icon, seeAllKey, children, loading }: {
  title: string; icon?: React.ElementType; seeAllKey?: string;
  children: React.ReactNode; loading?: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-zinc-500" />}
          <h2 className="text-[14px] font-semibold text-zinc-100 tracking-tight">{title}</h2>
        </div>
        {seeAllKey && (
          <button
            onClick={() => navigate(`/see-all/${seeAllKey}`)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="flex items-center gap-0.5 text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-none w-[130px] sm:w-[144px]">
              <div className="aspect-square rounded-xl bg-white/5 animate-pulse" />
              <div className="h-2.5 bg-white/5 rounded mt-2 w-3/4 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {children}
        </div>
      )}
    </section>
  );
};

// ── Featured Card ──────────────────────────────────────────
const FeaturedCard = ({ song, onPlay, pool, isPersonalized }: {
  song: Song;
  onPlay: (s: Song, pool: Song[]) => void;
  pool: Song[];
  isPersonalized?: boolean; // ✅ badge switch karne ke liye
}) => {
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const isPlaying   = currentSong?.id === song.id && status === 'playing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => onPlay(song, pool)}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPlay(song, pool)}
      style={{ aspectRatio: '21/9', WebkitTapHighlightColor: 'transparent' }}
      className="relative rounded-2xl overflow-hidden cursor-pointer group select-none"
    >
      <img src={song.thumbnail} alt={song.title} draggable={false} loading="lazy" decoding="async"
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between gap-4 pointer-events-none">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {/* ✅ Badge: Personalized ya Trending */}
            {isPersonalized ? (
              <span className="text-[10.5px] font-semibold text-violet-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Picked for you
              </span>
            ) : (
              <span className="text-[10.5px] font-semibold text-orange-400 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Trending
              </span>
            )}
            {song.tags?.[0] && (
              <span className="text-[10.5px] text-zinc-400">
                {GENRES.find(g => g.id === song.tags![0])?.label}
              </span>
            )}
          </div>
          <h2 className="text-white text-lg sm:text-2xl font-bold tracking-tight truncate leading-snug">
            {song.title}
          </h2>
        </div>
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
          {isPlaying ? <EqBars /> : <Play className="w-5 h-5 text-white fill-white ml-0.5" />}
        </div>
      </div>
    </motion.div>
  );
};

// ── Genre Banner Card ──────────────────────────────────────
const GenreBannerCard = ({ genre, songCount, onClick }: {
  genre: { id: string; label: string };
  songCount: number;
  onClick: () => void;
}) => {
  const [from, to] = GENRE_COLORS[genre.id] ?? ['#5b2c6f', '#4a235a'];
  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ WebkitTapHighlightColor: 'transparent', background: `linear-gradient(135deg, ${from}, ${to})` }}
      className="relative rounded-2xl overflow-hidden cursor-pointer select-none aspect-[3/2] flex flex-col justify-end p-4"
    >
      <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute right-4 -bottom-8 w-32 h-32 rounded-full bg-black/15 pointer-events-none" />
      <p className="text-[17px] font-bold text-white leading-tight z-10">{genre.label}</p>
      <p className="text-[11px] text-white/60 mt-0.5 z-10">{songCount} songs</p>
    </motion.div>
  );
};

// ── Genre Songs View ───────────────────────────────────────
const GenreSongsView = ({ genreId, songs, onPlay, onBack, onAddToPlaylist }: {
  genreId: string;
  songs: Song[];
  onPlay: (s: Song, pool: Song[]) => void;
  onBack: () => void;
  onAddToPlaylist: (s: Song) => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const genre      = GENRES.find(g => g.id === genreId);
  const [from, to] = GENRE_COLORS[genreId] ?? ['#5b2c6f', '#4a235a'];
  const currentSong = usePlayerStore(s => s.currentSong);
  const addToQueue  = usePlayerStore(s => s.addToQueue);
  const user        = useAuthStore(s => s.user);

  const filtered = useMemo(
    () => shuffle(songs.filter(s => s.tags?.includes(genreId)), 8888),
    [songs, genreId],
  );
  const visible = showAll ? filtered : filtered.slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onBack}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="flex items-center gap-1.5 text-[12.5px] text-zinc-500 hover:text-zinc-200 transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> All Genres
      </button>

      <div
        className="rounded-2xl p-5 mb-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest mb-1">Genre</p>
        <p className="text-[26px] font-extrabold text-white leading-tight">{genre?.label}</p>
        <p className="text-[12px] text-white/60 mt-1">{filtered.length} songs</p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <Music2 className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-[13px] text-zinc-500">No songs in this genre yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map((song, i) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.04, 0.2) }}
                onClick={() => onPlay(song, filtered)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onPlay(song, filtered)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={cn(
                  'cursor-pointer group rounded-xl overflow-hidden border transition-all duration-150 select-none',
                  currentSong?.id === song.id
                    ? 'border-violet-500/40 bg-violet-500/5'
                    : 'border-white/[0.06] hover:border-white/10 active:bg-white/6 bg-zinc-900/50',
                )}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img src={song.thumbnail} alt={song.title} draggable={false} loading="lazy" decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 z-10">
                    <button
                      onClick={e => { e.stopPropagation(); addToQueue(song); }}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-zinc-300 hover:bg-black/80 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {user && (
                      <button
                        onClick={e => { e.stopPropagation(); onAddToPlaylist(song); }}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                        className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-zinc-300 hover:bg-violet-500/80 transition-all"
                      >
                        <ListPlus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2.5 pointer-events-none">
                  <p className="text-[12.5px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                    {song.title}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length > 8 && (
            <button
              onClick={() => setShowAll(p => !p)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/4 border border-white/[0.07] text-[12.5px] text-zinc-500 hover:text-zinc-300 transition-all"
            >
              {showAll ? 'Show less' : `Show ${filtered.length - 8} more`}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
};

// ── Quick Play Skeleton ────────────────────────────────────
const QuickPlaySkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
        <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-white/5 rounded animate-pulse w-3/4" />
          <div className="h-2 bg-white/5 rounded animate-pulse w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════
// ── Home ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
export default function Home() {
  const { songs, isLoading }  = useSongFeed();
  const { songs: allSongs }   = useAllSongs();
  const { counts: genreCounts } = useGenreCounts();
  const { likedIds }          = useLikes();
  const user                  = useAuthStore(s => s.user);
  const play                  = usePlayerStore(s => s.play);
  const setCategoryPool       = usePlayerStore(s => s.setCategoryPool);
  const { recent, addRecent } = useRecentlyPlayed();

  // ✅ Personalized feed — hero + quickPlay from likes/history
  const {
    hero: personalizedHero,
    quickPlay: personalizedQuick,
    loading: personalizedLoading,
  } = usePersonalizedFeed();

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [playlistSong,  setPlaylistSong]  = useState<Song | null>(null);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handlePlay = (song: Song, pool: Song[]) => {
    play(song, pool, user?.uid);
    addRecent(song);
    setCategoryPool(pool);
  };

  const handleAddToPlaylist = (song: Song) => setPlaylistSong(song);

  // ── Feed sections (paginated songs) ─────────────────────
  const trending = useMemo(() =>
    shuffle([...songs].sort((a, b) => b.likeCount - a.likeCount), 1001).slice(0, 12),
    [songs]);

  const recentAdded = useMemo(() =>
    shuffle(songs.slice(0, 30), 2002).slice(0, 12),
    [songs]);

  const pickedForYou = useMemo(() =>
    shuffle(songs.filter(s => !likedIds.has(s.id)), 3003).slice(0, 12),
    [songs, likedIds]);

  const likedSongs = useMemo(() =>
    shuffle(songs.filter(s => likedIds.has(s.id)), 4004).slice(0, 12),
    [songs, likedIds]);

  const jumpBack = recent.slice(0, 12);

  // ✅ Hero: personalized song if available, else trending[0]
  const heroSong        = personalizedHero ?? trending[0] ?? null;
  const isHeroPersonal  = !!personalizedHero;
  const heroPool        = isHeroPersonal
    ? [personalizedHero!, ...trending].filter(Boolean)
    : trending;

  // ✅ Quick Play: personalized if available, else random
  const quickPlaySongs  = personalizedQuick.length > 0
    ? personalizedQuick
    : shuffle(songs, 5005).slice(0, 6);
  const quickLoading    = isLoading || personalizedLoading;

  return (
    <div className="pb-32 lg:pb-12">

      {/* Global Add to Playlist Modal */}
      <AddToPlaylistModal
        song={playlistSong}
        onClose={() => setPlaylistSong(null)}
      />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[12px] text-zinc-500 font-medium">
            {greeting}{user ? ` · ${user.name.split(' ')[0]}` : ''}
          </p>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight leading-tight mt-0.5">
            {/* ✅ Title changes based on personalization */}
            {user && isHeroPersonal ? 'Made for you ✨' : "What's playing today?"}
          </h1>
        </div>
        {user && (
          <div className="w-9 h-9 rounded-full bg-violet-600/80 flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0 ring-1 ring-white/10">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </motion.div>

      {/* ✅ Featured Card — personalized or trending */}
      {(isLoading && personalizedLoading)
        ? <div className="rounded-2xl bg-white/4 animate-pulse w-full" style={{ aspectRatio: '21/9' }} />
        : heroSong && (
          <FeaturedCard
            song={heroSong}
            onPlay={handlePlay}
            pool={heroPool}
            isPersonalized={isHeroPersonal}
          />
        )
      }

      {/* ✅ Quick Play — personalized if user logged in */}
      <section className="mt-7">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-[14px] font-semibold text-zinc-100">
            {/* ✅ Label changes based on personalization */}
            {user && personalizedQuick.length > 0 ? 'Because you liked' : 'Quick Play'}
          </h2>
          {user && personalizedQuick.length > 0 && (
            <span className="text-[10px] bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-full font-medium">
              personalized
            </span>
          )}
        </div>
        {quickLoading
          ? <QuickPlaySkeleton />
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickPlaySongs.map(s => (
                <QuickRow key={s.id} song={s}
                  onPlay={handlePlay} pool={quickPlaySongs}
                  onAddToPlaylist={handleAddToPlaylist} />
              ))}
            </div>
          )
        }
      </section>

      {/* Jump Back In */}
      {jumpBack.length > 0 && (
        <HSection title="Jump Back In" icon={History} seeAllKey="jumpback">
          {jumpBack.map((s, i) => (
            <MiniCard key={s.id} song={s} index={i}
              onPlay={handlePlay} pool={jumpBack}
              onAddToPlaylist={handleAddToPlaylist} />
          ))}
        </HSection>
      )}

      {/* Recently Added */}
      <HSection title="Recently Added" icon={Clock} seeAllKey="recent" loading={isLoading}>
        {recentAdded.map((s, i) => (
          <MiniCard key={s.id} song={s} index={i}
            onPlay={handlePlay} pool={recentAdded}
            onAddToPlaylist={handleAddToPlaylist} />
        ))}
      </HSection>

      {/* Trending */}
      <HSection title="Trending" icon={Flame} seeAllKey="trending" loading={isLoading}>
        {trending.map((s, i) => (
          <MiniCard key={s.id} song={s} index={i}
            onPlay={handlePlay} pool={trending}
            onAddToPlaylist={handleAddToPlaylist} />
        ))}
      </HSection>

      {/* Picked For You */}
      {pickedForYou.length > 0 && (
        <HSection title="Picked For You" icon={Sparkles} seeAllKey="picked">
          {pickedForYou.map((s, i) => (
            <MiniCard key={s.id} song={s} index={i}
              onPlay={handlePlay} pool={pickedForYou}
              onAddToPlaylist={handleAddToPlaylist} />
          ))}
        </HSection>
      )}

      {/* Liked */}
      {likedSongs.length > 0 && (
        <HSection title="Your Likes" icon={Sparkles} seeAllKey="liked">
          {likedSongs.map((s, i) => (
            <MiniCard key={s.id} song={s} index={i}
              onPlay={handlePlay} pool={likedSongs}
              onAddToPlaylist={handleAddToPlaylist} />
          ))}
        </HSection>
      )}

      {/* Browse by Genre */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Music2 className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-[14px] font-semibold text-zinc-100">Browse by Genre</h2>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedGenre ?? 'banners'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {!selectedGenre ? (
              isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[3/2] rounded-2xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {GENRES.map(g => (
                    <GenreBannerCard
                      key={g.id} genre={g}
                      songCount={genreCounts[g.id] ?? 0}
                      onClick={() => setSelectedGenre(g.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              <GenreSongsView
                genreId={selectedGenre}
                songs={allSongs}
                onPlay={handlePlay}
                onBack={() => setSelectedGenre(null)}
                onAddToPlaylist={handleAddToPlaylist}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ✅ Footer — proper spacing, player bar ke upar clear space */}
      <footer className="mt-16 pb-2 pt-6 border-t border-white/[0.05]">
        <div className="flex flex-col items-center gap-1">
          <p className="text-[13px] font-bold text-zinc-400 tracking-tight">Zuno</p>
          <p className="text-[11px] text-zinc-700">
            © {new Date().getFullYear()} EpicApp Innovations. All rights reserved.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10.5px] text-zinc-800 hover:text-zinc-500 cursor-pointer transition-colors">Privacy</span>
            <span className="text-zinc-800">·</span>
            <span className="text-[10.5px] text-zinc-800 hover:text-zinc-500 cursor-pointer transition-colors">Terms</span>
            <span className="text-zinc-800">·</span>
            <span className="text-[10.5px] text-zinc-800 hover:text-zinc-500 cursor-pointer transition-colors">About</span>
          </div>
        </div>
      </footer>

    </div>
  );
}