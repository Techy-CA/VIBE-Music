import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { EditSongModal } from './EditSongModal';
import type { Song } from '../../types';

export const AdminSongActions = ({ song }: { song: Song }) => {
  const { isAdmin, deleteSong } = useAdmin();
  const [editOpen, setEditOpen]   = useState(false);
  const [deleting, setDeleting]   = useState(false);

  if (!isAdmin) return null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${song.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    await deleteSong(song.id);
  };

  return (
    <>
      <EditSongModal song={editOpen ? song : null} onClose={() => setEditOpen(false)} />
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button
          onClick={e => { e.stopPropagation(); setEditOpen(true); }}
          className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all"
          title="Edit song"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-6 h-6 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
          title="Delete song"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </>
  );
};