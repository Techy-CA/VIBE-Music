import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music2, Heart, X, LogOut } from 'lucide-react';
import { useAuthStore }    from '../store/useAuthStore';
import { useAuth }         from '../hooks/useAuth';
import { usePlayerStore }  from '../store/usePlayerStore';
import { useLikes }        from '../hooks/useLikes';
import { usePlaylists }    from '../hooks/usePlaylist';   // ✅ fixed: was 'usePlaylist'
import { useAdmin }        from '../hooks/useAdmin';       // ✅ admin controls
import { getSongsByUser, getUserProfile } from '../lib/firestore';
import { Avatar }           from '../components/ui/Avatar';
import { AdminSongActions } from '../components/admin/AdminSongRow'; // ✅ admin edit/delete
import type { Song, UserProfile } from '../types';
import { cn } from '../utils/cn';

// ── Stat Card ──────────────────────────────────────────────
const Stat = ({ value, label }: { value: number | string; label: string }) => (
  <div className="text-center">
    <p className="text-xl font-bold text-white">{value}</p>
    <p className="text-[11px] text-zinc-500 mt-0.5">{label}</p>
  </div>
);

// ── Song Row ───────────────────────────────────────────────
const SongRow = ({ song, index, onDelete, isOwner }: {
  song: Song; index: number; onDelete?: (id: string) => void; isOwner: boolean;
}) => {
  const play        = usePlayerStore(s => s.play);
  const currentSong = usePlayerStore(s => s.currentSong);
  const status      = usePlayerStore(s => s.status);
  const { likedIds, handleToggle } = useLikes();
  const { isAdmin }  = useAdmin();
  const user         = useAuthStore(s => s.user);

  const active  = currentSong?.id === song.id;
  const playing = active && status === 'playing';
  const liked   = likedIds.has(song.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer',
        active ? 'bg-white/7 border border-white/8' : 'hover:bg-white/4 border border-transparent',
      )}
      onClick={() => play(song)}
    >
      {/* Index / playing indicator */}
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {playing ? (
          <div className="flex items-end gap-px h-3.5">
            {[2,3,2].map((h,i) => (
              <motion.span key={i} className="w-0.5 bg-violet-400 rounded-full"
                animate={{ height: [h, h+3, h] }}
                transition={{ repeat: Infinity, duration: 0.5, delay: i*0.1 }}
                style={{ height: h }} />
            ))}
          </div>
        ) : (
          <>
            <span className="text-[11px] text-zinc-600 group-hover:hidden">{index + 1}</span>
            <svg viewBox="0 0 24 24" fill="currentColor"
              className="w-3.5 h-3.5 text-zinc-400 hidden group-hover:block ml-0.5">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </>
        )}
      </div>

      {/* Thumbnail */}
      <img src={song.thumbnail} alt={song.title}
        className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />

      {/* Title */}
      <p className="flex-1 text-[13px] font-medium text-zinc-300 truncate group-hover:text-white transition-colors">
        {song.title}
      </p>

      {/* Like */}
      {user && (
        <button
          onClick={e => { e.stopPropagation(); handleToggle(song.id); }}
          className={cn(
            'flex items-center gap-1 text-[11px] transition-colors px-1',
            liked ? 'text-pink-500' : 'text-zinc-700 hover:text-pink-400',
          )}
        >
          <Heart className={cn('w-3.5 h-3.5', liked && 'fill-pink-500')} />
          <span>{song.likeCount}</span>
        </button>
      )}

      {/* ✅ Admin controls — edit + delete visible only to admin */}
      {isAdmin && (
        <div onClick={e => e.stopPropagation()}>
          <AdminSongActions song={song} />
        </div>
      )}

      {/* Owner delete (non-admin owner) */}
      {isOwner && !isAdmin && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(song.id); }}
          className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
};

// ── Profile Page ───────────────────────────────────────────
export default function Profile() {
  const { userId }      = useParams<{ userId?: string }>();
  const currentUser     = useAuthStore(s => s.user);
  const { signOutUser } = useAuth();
  const { playlists }   = usePlaylists();   // ✅ correct hook name
  const { likedIds }    = useLikes();

  const [profile,   setProfile  ] = useState<UserProfile | null>(null);
  const [songs,     setSongs    ] = useState<Song[]>([]);
  const [loading,   setLoading  ] = useState(true);
  const [activeTab, setActiveTab] = useState<'songs' | 'liked'>('songs');

  const targetId = userId || currentUser?.id;
  const isOwner  = targetId === currentUser?.id;

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    Promise.all([
      getUserProfile(targetId),
      getSongsByUser(targetId),
    ]).then(([prof, s]) => {
      setProfile(prof);
      setSongs(s);
      setLoading(false);
    });
  }, [targetId]);

  const handleDelete = (songId: string) => {
    setSongs(prev => prev.filter(s => s.id !== songId));
  };

  const displayProfile = isOwner ? currentUser : profile;
  const likedSongs     = songs.filter(s => likedIds.has(s.id));

  return (
    <div>
      {/* ── Header ── */}
      <div className="relative mb-8">
        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
          {songs[0] && (
            <img src={songs[0].thumbnail} alt=""
              className="w-full h-full object-cover opacity-10 blur-2xl scale-110" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0d0d]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative flex items-end gap-5 pt-8 pb-6"
        >
          <Avatar
            src={displayProfile?.photoURL}
            name={displayProfile?.name}
            size="xl"
            className="ring-2 ring-white/10 shadow-2xl"
          />

          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">
              {isOwner ? 'Your Profile' : 'Profile'}
            </p>
            <h1 className="text-2xl font-bold text-white tracking-tight truncate">
              {loading
                ? <div className="h-7 w-40 bg-white/5 rounded-lg animate-pulse" />
                : displayProfile?.name ?? 'Unknown'
              }
            </h1>
            <p className="text-[12px] text-zinc-500 mt-0.5 truncate">
              {isOwner ? displayProfile?.email : `${songs.length} songs shared`}
            </p>
          </div>

          {isOwner && (
            <button
              onClick={signOutUser}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-zinc-400 hover:text-red-400 hover:bg-red-500/8 hover:border-red-500/20 text-[12px] font-medium transition-all duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          )}
        </motion.div>

        {/* Stats */}
        <div className="relative flex items-center gap-6 pt-4 border-t border-white/[0.06]">
          <Stat value={songs.length}                             label="Songs"       />
          <div className="w-px h-6 bg-white/8" />
          <Stat value={likedIds.size}                            label="Liked"       />
          <div className="w-px h-6 bg-white/8" />
          <Stat value={playlists.length}                         label="Playlists"   />
          <div className="w-px h-6 bg-white/8" />
          <Stat value={songs.reduce((a, s) => a + s.likeCount, 0)} label="Total Likes" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {(['songs', 'liked'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-150',
              activeTab === tab
                ? 'bg-white/8 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab === 'songs' ? `Songs (${songs.length})` : `Liked (${likedIds.size})`}
          </button>
        ))}
      </div>

      {/* ── Song List ── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[52px] bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'songs' ? (
        songs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-dashed border-white/10 flex items-center justify-center mb-4">
              <Music2 className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-[13px] font-medium text-zinc-500">No songs added yet</p>
            <p className="text-[12px] text-zinc-700 mt-1">
              {isOwner ? 'Add your first song from the sidebar.' : "This user hasn't added any songs."}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {songs.map((song, i) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                isOwner={isOwner}
                onDelete={isOwner ? handleDelete : undefined}
              />
            ))}
          </div>
        )
      ) : (
        likedSongs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-dashed border-white/10 flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-[13px] font-medium text-zinc-500">No liked songs yet</p>
            <p className="text-[12px] text-zinc-700 mt-1">Songs you like will appear here.</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5">
            {likedSongs.map((song, i) => (
              <SongRow key={song.id} song={song} index={i} isOwner={false} />
            ))}
          </div>
        )
      )}
    </div>
  );
}