import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ListMusic, Loader2 } from 'lucide-react';
import { usePlaylists } from '../../hooks/usePlaylist';
import type { Playlist } from '../../types';

interface Props { playlist: Playlist | null; onClose: () => void; }

export const EditPlaylistModal = ({ playlist, onClose }: Props) => {
  const { renamePlaylist } = usePlaylists();
  const [name,    setName   ] = useState('');
  const [desc,    setDesc   ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState('');

  useEffect(() => {
    if (playlist) { setName(playlist.name); setDesc(playlist.description ?? ''); setError(''); }
  }, [playlist]);

  const handleClose = () => { if (loading) return; onClose(); };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!playlist)    return;
    setError(''); setLoading(true);
    await renamePlaylist(playlist.id, name.trim());
    setLoading(false);
    onClose();
  };

  const modal = (
    <AnimatePresence>
      {!!playlist && (
        <motion.div
          key="edit-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.93, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(92vw, 440px)' }}
            className="bg-[#141418] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                  <ListMusic className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-[14.5px] font-bold text-white">Edit Playlist</h2>
                  <p className="text-[11px] text-zinc-600">Update name or description</p>
                </div>
              </div>
              <button onClick={handleClose} disabled={loading}
                className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  maxLength={60} disabled={loading}
                  className="w-full bg-white/[0.06] border border-white/[0.09] rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-zinc-600 outline-none focus:border-violet-500/60 focus:bg-white/[0.09] disabled:opacity-50 transition-all"
                />
                {error && <p className="text-[11.5px] text-red-400 mt-1.5">{error}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Description <span className="text-zinc-700 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={desc} onChange={e => setDesc(e.target.value)}
                  maxLength={120} rows={2} disabled={loading}
                  className="w-full bg-white/[0.06] border border-white/[0.09] rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-zinc-600 resize-none outline-none focus:border-violet-500/60 focus:bg-white/[0.09] disabled:opacity-50 transition-all"
                />
                <p className="text-[10.5px] text-zinc-700 text-right mt-1">{name.length}/60</p>
              </div>
              <div className="flex gap-2.5 pt-1">
                <button onClick={handleClose} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-white/6 border border-white/[0.08] text-zinc-400 text-[13.5px] font-medium hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40 transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={!name.trim() || loading}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
};