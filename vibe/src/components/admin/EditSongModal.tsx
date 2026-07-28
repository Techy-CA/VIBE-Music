import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { GENRES } from '../../types';
import type { Song } from '../../types';

interface Props { song: Song | null; onClose: () => void; }

export const EditSongModal = ({ song, onClose }: Props) => {
  const { updateSong } = useAdmin();
  const [title, setTitle]   = useState(song?.title ?? '');
  const [tags, setTags]     = useState<string[]>(song?.tags ?? []);
  const [loading, setLoading] = useState(false);

  if (!song) return null;

  const toggleTag = (id: string) =>
    setTags(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);

  const handleSave = async () => {
    setLoading(true);
    await updateSong(song.id, { title: title.trim(), tags });
    setLoading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="fixed z-[120] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[420px] rounded-2xl bg-[#141418] border border-white/[0.08] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-bold text-white">Edit Song</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail preview */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-white/4 border border-white/[0.06]">
          <img src={song.thumbnail} alt={song.title}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          <p className="text-[12px] text-zinc-500 truncate">{song.id}</p>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-1.5 block">
              Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[13.5px] text-white outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2 block">
              Genres
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map(g => (
                <button
                  key={g.id}
                  onClick={() => toggleTag(g.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-all ${
                    tags.includes(g.id)
                      ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/4 border-white/[0.07] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/6 text-zinc-400 text-[13px] font-medium hover:bg-white/8 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold transition-all flex items-center justify-center gap-2">
            <Save className="w-3.5 h-3.5" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};