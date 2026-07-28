import { useState, useRef, type JSXElementConstructor, type Key, type ReactElement, type ReactNode, type ReactPortal } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Heart, Plus, MoreVertical, ListPlus, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { usePlayerStore }  from '../../store/usePlayerStore';
import { useLikes }        from '../../hooks/useLikes';
import { useAuthStore }    from '../../store/useAuthStore';
import { usePlaylist }     from '../../hooks/usePlaylist';
import type { Song } from '../../types';

export const SongCard = ({ song, index = 0, onDelete }: {
  song: Song; index?: number; onDelete?: (id: string) => void;
}) => {
  const [imgError,   setImgError  ] = useState(false);
  const [menuOpen,   setMenuOpen  ] = useState(false);
  const [showAddPL,  setShowAddPL ] = useState(false);

  const { currentSong, play, addToQueue, status } = usePlayerStore();
  const { likedIds, handleToggle, pendingIds }    = useLikes();
  const user      = useAuthStore(s => s.user);
  const { playlists, addToPlaylist } = usePlaylist();

  const isCurrentlyPlaying = currentSong?.id === song.id && status === 'playing';
  const isActive  = currentSong?.id === song.id;
  const isLiked   = likedIds.has(song.id);
  const isPending = pendingIds.has(song.id);
  const thumbnail = imgError
    ? `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg`
    : song.thumbnail;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'group relative bg-[#111120] border border-white/7 rounded-2xl overflow-hidden',
        'transition-all duration-400 hover:-translate-y-1.5',
        'hover:shadow-2xl hover:shadow-purple-950/40 hover:border-white/15',
        isActive && 'border-purple-500/50 shadow-lg shadow-purple-950/40',
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={thumbnail} alt={song.title}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Playing animation bars */}
        {isActive && (
          <div className="absolute top-3 left-3 flex items-end gap-0.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1.5">
            {[3, 5, 4, 6, 3].map((h, i) => (
              <motion.span
                key={i}
                className="w-0.5 bg-purple-400 rounded-full"
                animate={isCurrentlyPlaying
                  ? { height: [h, h + 6, h], transition: { repeat: Infinity, duration: 0.6, delay: i * 0.1 } }
                  : { height: 3 }
                }
                style={{ height: h }}
              />
            ))}
          </div>
        )}

        {/* Play button - center on hover */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => play(song)}
            className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center shadow-2xl shadow-purple-900/70 hover:bg-purple-500 hover:scale-105 transition-all duration-200"
          >
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </motion.button>
        </motion.div>

        {/* Bottom bar on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center justify-between">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => addToQueue(song)}
              className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-white font-medium hover:bg-white/25 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Queue
            </motion.button>

            {/* More menu */}
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-white" />
              </motion.button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute bottom-10 right-0 w-48 bg-[#1a1a2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
                    onMouseLeave={() => { setMenuOpen(false); setShowAddPL(false); }}
                  >
                    <button
                      onClick={() => { setShowAddPL(!showAddPL); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-white/5 transition-colors"
                    >
                      <ListPlus className="w-4 h-4 text-purple-400" />
                      Add to Playlist
                    </button>

                    {showAddPL && (
                      <div className="border-t border-white/5">
                        {playlists.length === 0 ? (
                          <p className="text-xs text-slate-500 px-4 py-3">No playlists yet</p>
                        ) : (
                          playlists.map((pl: { id: Key | null | undefined; name: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; }) => (
                            <button key={pl.id}
                              onClick={() => { addToPlaylist(pl.id, song.id, song.thumbnail); setMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                              <div className="w-6 h-6 rounded bg-purple-600/30 flex items-center justify-center text-[10px]">🎵</div>
                              <span className="truncate">{pl.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {user && song.addedBy === user.id && onDelete && (
                      <button
                        onClick={() => { onDelete(song.id); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove Song
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3
          onClick={() => play(song)}
          className="font-semibold text-slate-100 text-sm leading-snug line-clamp-2 mb-3 group-hover:text-white transition-colors cursor-pointer"
        >
          {song.title}
        </h3>

        <div className="flex items-center justify-between">
          {/* Like button */}
          {user ? (
            <motion.button
              whileTap={{ scale: 0.75 }}
              onClick={() => handleToggle(song.id)}
              disabled={isPending}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium transition-all duration-200',
                isLiked ? 'text-pink-500' : 'text-slate-600 hover:text-pink-400',
              )}
            >
              <motion.div animate={isLiked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }}>
                <Heart className={cn('w-4 h-4', isLiked && 'fill-pink-500')} />
              </motion.div>
              <span>{song.likeCount}</span>
            </motion.button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Heart className="w-4 h-4" />
              <span>{song.likeCount}</span>
            </div>
          )}

          {/* Duration placeholder / play btn */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => play(song)}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
              isActive
                ? 'bg-purple-600 shadow-glow'
                : 'bg-white/8 hover:bg-purple-600/80',
            )}
          >
            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};