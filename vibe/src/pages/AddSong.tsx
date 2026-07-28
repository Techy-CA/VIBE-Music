import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, Music2, RefreshCw, Share2, Tag,
  Upload, CheckCircle2, XCircle, Loader2,
  ChevronDown, List, Plus, AlertTriangle,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db }             from '../lib/firebase';
import { fetchVideoMeta } from '../lib/youtube';
import { addSong }        from '../lib/firestore';
import { useAuthStore }   from '../store/useAuthStore';
import { useNavigate }    from 'react-router-dom';
import { GENRES }         from '../types';
import { cn }             from '../utils/cn';


type Meta   = { title: string; thumbnail: string; videoId: string };
type Mode   = 'single' | 'bulk';
type Status = 'idle' | 'fetching' | 'ready' | 'uploading' | 'done' | 'error';


interface BulkItem {
  url:       string;
  meta:      Meta | null;
  status:    'pending' | 'fetching' | 'done' | 'error' | 'duplicate';
  error?:    string;
  isDuplicate?: boolean;
}


// ── Keywords to strip from titles ─────────────────────────
const TITLE_STRIP_PATTERNS = [
  // Resolutions & quality
  /\b(4k|8k|hd|fhd|uhd|1080p|720p|480p|2160p)\b/gi,
  // Common suffixes
  /[\(\[【]\s*(official\s*)?(music\s*)?video\s*[\)\]】]/gi,
  /[\(\[【]\s*(official\s*)?audio\s*[\)\]】]/gi,
  /[\(\[【]\s*(official\s*)?lyric(s)?\s*(video)?\s*[\)\]】]/gi,
  /[\(\[【]\s*full\s*(video|song|audio)?\s*[\)\]】]/gi,
  /[\(\[【]\s*(hd|hq|4k|8k)\s*[\)\]】]/gi,
  /[\(\[【][^\]\)】]*lyrics[^\]\)】]*[\)\]】]/gi,
  // Inline keywords (with or without brackets)
  /\|\s*(official\s*)?(music\s*)?video/gi,
  /[-–|]\s*(official\s*)?(music\s*)?video/gi,
  /[-–|]\s*(official\s*)?audio/gi,
  /\b(official\s+music\s+video)\b/gi,
  /\b(official\s+video)\b/gi,
  /\b(official\s+audio)\b/gi,
  /\b(official\s+lyric(s)?\s*video)\b/gi,
  /\b(lyric(s)?\s*video)\b/gi,
  /\b(music\s+video)\b/gi,
  /\b(full\s+video)\b/gi,
  /\b(video\s+song)\b/gi,
  // Trailing separators
  /\s*[-–|:]\s*$/,
  // Extra whitespace
  /\s{2,}/g,
];

const cleanTitle = (raw: string): string => {
  let title = raw;
  for (const pattern of TITLE_STRIP_PATTERNS) {
    title = title.replace(pattern, ' ');
  }
  return title.trim();
};


// ── Check if videoId already exists in Firestore ──────────
const checkDuplicate = async (videoId: string): Promise<boolean> => {
  try {
    const q    = query(collection(db, 'songs'), where('videoId', '==', videoId));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
};


// ── Extract YouTube video ID ───────────────────────────────
const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};


// ── Parse raw text → array of YouTube URLs ────────────────
const parseUrls = (raw: string): string[] => {
  const lines = raw.split(/[\n,\s]+/);
  return lines
    .map(l => l.trim().replace(/^\[|\]$/g, ''))
    .filter(l => l.includes('youtube.com') || l.includes('youtu.be'))
    .filter((v, i, a) => a.indexOf(v) === i);
};


// ── Status badge ───────────────────────────────────────────
const Badge = ({ status }: { status: BulkItem['status'] }) => {
  if (status === 'fetching')
    return <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />;
  if (status === 'done')
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (status === 'duplicate')
    return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  if (status === 'error')
    return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />;
};


// ──────────────────────────────────────────────────────────
export default function AddSong() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const textRef  = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<Mode>('single');

  // Single mode
  const [url,         setUrl        ] = useState('');
  const [meta,        setMeta       ] = useState<Meta | null>(null);
  const [tags,        setTags       ] = useState<string[]>([]);
  const [loading,     setLoading    ] = useState(false);
  const [sharing,     setSharing    ] = useState(false);
  const [error,       setError      ] = useState('');
  const [imgError,    setImgError   ] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false); // ✅ NEW

  // Bulk mode
  const [rawText,    setRawText   ] = useState('');
  const [bulkItems,  setBulkItems ] = useState<BulkItem[]>([]);
  const [bulkTags,   setBulkTags  ] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<Status>('idle');
  const [doneCount,  setDoneCount ] = useState(0);
  const [errCount,   setErrCount  ] = useState(0);
  const [showItems,  setShowItems ] = useState(false);


  // ── Single mode handlers ──────────────────────────────
  const toggleTag = (id: string) =>
    setTags(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setMeta(null);
    setImgError(false);
    setTags([]);
    setIsDuplicate(false);

    try {
      const result = await fetchVideoMeta(url.trim());
      if (!result) {
        setError('Invalid YouTube URL.');
      } else {
        // ✅ Clean title + duplicate check simultaneously
        const [isDup] = await Promise.all([
          checkDuplicate(result.videoId),
        ]);

        setMeta({ ...result, title: cleanTitle(result.title) }); // ✅ cleaned title
        setIsDuplicate(isDup);
      }
    } catch {
      setError('Failed to fetch. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!meta || !user || isDuplicate) return;
    setSharing(true);
    try {
      await addSong({
        title: meta.title, youtubeUrl: url.trim(), videoId: meta.videoId,
        thumbnail: meta.thumbnail, addedBy: user.id, addedByName: user.name,
        addedByPhoto: user.photoURL, tags,
        duration: 0
      });
      navigate('/');
    } catch {
      setError('Failed to share. Try again.');
      setSharing(false);
    }
  };

  const reset = () => {
    setMeta(null); setUrl(''); setError('');
    setImgError(false); setTags([]); setIsDuplicate(false);
  };

  const thumbSrc = imgError
    ? `https://img.youtube.com/vi/${meta?.videoId}/mqdefault.jpg`
    : meta?.thumbnail;


  // ── Bulk mode handlers ─────────────────────────────────
  const toggleBulkTag = (id: string) =>
    setBulkTags(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);

  const handleBulkFetchAll = async () => {
    const urls = parseUrls(rawText);
    if (!urls.length) return;

    const initial: BulkItem[] = urls.map(u => ({ url: u, meta: null, status: 'pending' }));
    setBulkItems(initial);
    setBulkStatus('fetching');
    setShowItems(true);

    const BATCH = 5;
    const updated = [...initial];

    for (let i = 0; i < updated.length; i += BATCH) {
      const batch = updated.slice(i, i + BATCH);
      await Promise.all(batch.map(async (item, bi) => {
        const idx = i + bi;
        setBulkItems(p => p.map((x, j) => j === idx ? { ...x, status: 'fetching' } : x));
        try {
          const result = await fetchVideoMeta(item.url);
          if (!result) {
            updated[idx] = { ...item, meta: null, status: 'error', error: 'Could not fetch' };
          } else {
            // ✅ Clean title + check duplicate
            const cleanedTitle = cleanTitle(result.title);
            const isDup        = await checkDuplicate(result.videoId);
            const cleanedMeta  = { ...result, title: cleanedTitle };

            updated[idx] = isDup
              ? {
                  ...item,
                  meta:        cleanedMeta,
                  status:      'duplicate',              // ✅ mark as duplicate
                  isDuplicate: true,
                  error:       'Already exists on Zuno',
                }
              : {
                  ...item,
                  meta:   cleanedMeta,
                  status: 'done' as const,
                };
          }
        } catch {
          updated[idx] = { ...item, meta: null, status: 'error', error: 'Network error' };
        }
        setBulkItems([...updated]);
      }));
    }

    setBulkStatus('ready');
  };

  const handleBulkUpload = async () => {
    if (!user) return;

    // ✅ Skip duplicates and errors — only upload fresh songs
    const ready = bulkItems.filter(i => i.meta && i.status === 'done');
    if (!ready.length) return;

    setBulkStatus('uploading');
    let done = 0, errs = 0;
    setDoneCount(0); setErrCount(0);

    const BATCH = 3;
    const updated = [...bulkItems];

    for (let i = 0; i < updated.length; i += BATCH) {
      const batch = updated.slice(i, i + BATCH);
      await Promise.all(batch.map(async (item, bi) => {
        const idx = i + bi;

        // ✅ Skip duplicates silently
        if (item.isDuplicate || item.status === 'duplicate' || item.status === 'error') return;
        if (!item.meta) return;

        setBulkItems(p => p.map((x, j) => j === idx ? { ...x, status: 'fetching' } : x));
        try {
          await addSong({
            title: item.meta.title, youtubeUrl: item.url,
            videoId: item.meta.videoId, thumbnail: item.meta.thumbnail,
            addedBy: user.id, addedByName: user.name,
            addedByPhoto: user.photoURL, tags: bulkTags,
            duration: 0
          });
          updated[idx] = { ...item, status: 'done' };
          done++;
          setDoneCount(done);
        } catch {
          updated[idx] = { ...item, status: 'error', error: 'Upload failed' };
          errs++;
          setErrCount(errs);
        }
        setBulkItems([...updated]);
      }));
    }

    setBulkStatus('done');
  };

  const bulkReset = () => {
    setRawText(''); setBulkItems([]); setBulkTags([]);
    setBulkStatus('idle'); setDoneCount(0); setErrCount(0); setShowItems(false);
  };

  const parsedCount    = parseUrls(rawText).length;
  const fetchedCount   = bulkItems.filter(i => i.meta && !i.isDuplicate).length; // ✅ exclude duplicates
  const duplicateCount = bulkItems.filter(i => i.isDuplicate).length;            // ✅ count duplicates
  const totalCount     = bulkItems.length;
  const progress       = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;


  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
          <Music2 className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-white tracking-tight">Add a Song</h1>
          <p className="text-[12px] text-zinc-500">Share what you're listening to</p>
        </div>
      </motion.div>

      {/* Mode Toggle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 }}
        className="flex gap-1.5 p-1 bg-white/[0.04] border border-white/[0.07] rounded-xl mb-5 w-fit">
        {(['single', 'bulk'] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all',
              mode === m
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'text-zinc-500 hover:text-zinc-300',
            )}>
            {m === 'single'
              ? <><Plus className="w-3.5 h-3.5" /> Single</>
              : <><List className="w-3.5 h-3.5" /> Bulk Import</>}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">

        {/* ══════════════ SINGLE MODE ══════════════ */}
        {mode === 'single' && (
          <motion.div key="single"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
            className="bg-[#111111] border border-white/[0.07] rounded-2xl p-5 w-full max-w-lg"
          >
            <AnimatePresence mode="wait">
              {!meta ? (
                <motion.div key="input"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  <label className="block text-[11.5px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-2">
                    Song Link
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                    <input type="url" value={url}
                      onChange={e => { setUrl(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && void handleFetch()}
                      placeholder="Paste a YouTube link..."
                      className="w-full h-10 bg-zinc-900 border border-white/8 rounded-xl pl-9 pr-4 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:bg-zinc-800 transition-all"
                    />
                  </div>
                  <AnimatePresence>
                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }} className="text-[12px] text-red-400 mt-2">
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <p className="text-[11.5px] text-zinc-700 mt-2 mb-4">
                    Paste any YouTube video or music link
                  </p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => void handleFetch()}
                    disabled={!url.trim() || loading}
                    className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-all flex items-center justify-center gap-2">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
                      : 'Fetch Song Info'}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="preview"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

                  {/* ✅ Duplicate warning banner */}
                  <AnimatePresence>
                    {isDuplicate && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 mb-4"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[12.5px] font-semibold text-amber-300">
                            Yeh song pehle se Zuno pe hai!
                          </p>
                          <p className="text-[11.5px] text-amber-500/80 mt-0.5">
                            Duplicate songs add nahi ho sakte. Koi aur song try karo.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative rounded-xl overflow-hidden aspect-video mb-4 bg-zinc-800">
                    <img src={thumbSrc} alt={meta.title}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    {/* ✅ Duplicate overlay */}
                    {isDuplicate && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 backdrop-blur-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-[12.5px] font-semibold text-amber-300">Already on Zuno</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="block text-[11.5px] font-semibold text-zinc-500 uppercase tracking-[0.08em] mb-2">
                      Song Name
                    </label>
                    <input type="text" value={meta.title}
                      onChange={e => setMeta({ ...meta, title: e.target.value })}
                      className="w-full h-10 bg-zinc-900 border border-white/8 rounded-xl px-3 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:bg-zinc-800 transition-all"
                    />
                  </div>

                  {/* Tags — disabled if duplicate */}
                  {!isDuplicate && (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Tag className="w-3.5 h-3.5 text-zinc-600" />
                        <label className="text-[11.5px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">Genre Tags</label>
                        <span className="text-[10.5px] text-zinc-700">(optional)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {GENRES.map(g => {
                          const active = tags.includes(g.id);
                          return (
                            <motion.button key={g.id} whileTap={{ scale: 0.93 }}
                              onClick={() => toggleTag(g.id)}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all border',
                                active
                                  ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                                  : 'bg-white/4 border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:bg-white/6',
                              )}>
                              <span>{g.emoji}</span>{g.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {error && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-[12px] text-red-400 mb-3">{error}</motion.p>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2">
                    <button onClick={reset}
                      className="flex-1 h-10 rounded-xl bg-white/5 border border-white/8 text-[13px] font-medium text-zinc-400 hover:text-white hover:bg-white/8 transition-all flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5" /> Change URL
                    </button>
                    {/* ✅ Share button disabled if duplicate */}
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => void handleShare()}
                      disabled={sharing || !meta.title.trim() || isDuplicate}
                      className={cn(
                        'flex-1 h-10 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2',
                        isDuplicate
                          ? 'bg-amber-600/20 border border-amber-500/30 text-amber-400 cursor-not-allowed opacity-70'
                          : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white',
                      )}>
                      {sharing
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : isDuplicate
                        ? <><AlertTriangle className="w-3.5 h-3.5" /> Duplicate</>
                        : <><Share2 className="w-3.5 h-3.5" /> Share Song</>}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ══════════════ BULK MODE ══════════════ */}
        {mode === 'bulk' && (
          <motion.div key="bulk"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
            className="w-full max-w-2xl space-y-4"
          >
            {/* Step 1 — Paste URLs */}
            <div className="bg-[#111111] border border-white/[0.07] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13.5px] font-semibold text-white">Paste YouTube Links</p>
                  <p className="text-[11.5px] text-zinc-600 mt-0.5">
                    One URL per line, or comma/space separated
                  </p>
                </div>
                {parsedCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-violet-600/20 border border-violet-500/30 text-[11.5px] font-semibold text-violet-300">
                    {parsedCount} URLs
                  </span>
                )}
              </div>

              <textarea
                ref={textRef}
                value={rawText}
                onChange={e => { setRawText(e.target.value); setBulkItems([]); setBulkStatus('idle'); }}
                placeholder={`https://www.youtube.com/watch?v=dESIGVxSSCE\nhttps://www.youtube.com/watch?v=Ans8Y59cvds\n...`}
                rows={8}
                className="w-full bg-zinc-900 border border-white/8 rounded-xl px-4 py-3 text-[12.5px] text-zinc-300 placeholder:text-zinc-700 font-mono resize-none focus:outline-none focus:border-violet-500/40 focus:bg-zinc-800 transition-all"
              />

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => void handleBulkFetchAll()}
                  disabled={parsedCount === 0 || bulkStatus === 'fetching' || bulkStatus === 'uploading'}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {bulkStatus === 'fetching'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking {bulkItems.filter(i => i.status !== 'pending').length}/{totalCount}...</>
                    : <><Link2 className="w-4 h-4" /> Fetch & Check Duplicates</>
                  }
                </button>
                {bulkStatus !== 'idle' && (
                  <button onClick={bulkReset}
                    className="h-10 px-4 rounded-xl bg-white/5 border border-white/8 text-zinc-400 hover:text-white text-[13px] transition-all flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* ✅ Duplicate summary banner */}
            {duplicateCount > 0 && bulkStatus === 'ready' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/20"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-300">
                    {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''} hataya gaya
                  </p>
                  <p className="text-[11.5px] text-amber-500/80 mt-0.5">
                    {duplicateCount} song{duplicateCount > 1 ? 's' : ''} pehle se Zuno pe exist {duplicateCount > 1 ? 'karte hain' : 'karta hai'} — inhe skip kar diya jayega.
                    Sirf {fetchedCount} naye song{fetchedCount !== 1 ? 's' : ''} upload honge.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Genre Tags */}
            {fetchedCount > 0 && bulkStatus !== 'fetching' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#111111] border border-white/[0.07] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-3.5 h-3.5 text-zinc-600" />
                  <p className="text-[13px] font-semibold text-white">Genre Tags</p>
                  <span className="text-[11px] text-zinc-600">(applies to all songs)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map(g => {
                    const active = bulkTags.includes(g.id);
                    return (
                      <motion.button key={g.id} whileTap={{ scale: 0.93 }}
                        onClick={() => toggleBulkTag(g.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all border',
                          active
                            ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                            : 'bg-white/4 border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:bg-white/6',
                        )}>
                        <span>{g.emoji}</span>{g.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 3 — Upload */}
            {(fetchedCount > 0 || duplicateCount > 0) && bulkStatus !== 'fetching' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#111111] border border-white/[0.07] rounded-2xl p-5">

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  {fetchedCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[12px] font-medium text-emerald-300">{fetchedCount} new</span>
                    </div>
                  )}
                  {duplicateCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[12px] font-medium text-amber-300">{duplicateCount} duplicate</span>
                    </div>
                  )}
                  {errCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[12px] font-medium text-red-300">{bulkItems.filter(i => i.status === 'error' && !i.isDuplicate).length} failed</span>
                    </div>
                  )}
                  {bulkStatus === 'done' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[12px] font-medium text-violet-300">{doneCount} uploaded!</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {bulkStatus === 'uploading' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11.5px] text-zinc-500">Uploading...</span>
                      <span className="text-[11.5px] text-zinc-400 font-medium">{doneCount}/{fetchedCount}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {bulkStatus !== 'done' ? (
                  <button
                    onClick={() => void handleBulkUpload()}
                    disabled={bulkStatus === 'uploading' || fetchedCount === 0}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
                  >
                    {bulkStatus === 'uploading'
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {doneCount}/{fetchedCount}...</>
                      : <><Upload className="w-4 h-4" /> Upload {fetchedCount} New Songs</>
                    }
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="w-full h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-[13.5px] font-semibold text-emerald-300">
                        {doneCount} songs uploaded successfully!
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={bulkReset}
                        className="flex-1 h-10 rounded-xl bg-white/5 border border-white/8 text-zinc-400 hover:text-white text-[13px] font-medium transition-all flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Import More
                      </button>
                      <button onClick={() => navigate('/')}
                        className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold transition-all">
                        Go to Home
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Song list preview */}
            {bulkItems.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-[#111111] border border-white/[0.07] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowItems(p => !p)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/4 transition-colors"
                >
                  <span className="text-[13px] font-semibold text-white">
                    Song Preview
                    <span className="text-zinc-600 font-normal ml-2 text-[12px]">
                      {bulkItems.filter(i => i.meta).length}/{bulkItems.length} fetched
                    </span>
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', showItems && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {showItems && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.04] px-2 pb-2">
                        {bulkItems.map((item, i) => (
                          <div key={i} className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                            item.isDuplicate && 'opacity-50',
                          )}>
                            <Badge status={item.status} />
                            {item.meta ? (
                              <img src={item.meta.thumbnail} alt=""
                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-white/5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-medium text-white truncate">
                                {item.meta?.title ?? 'Fetching...'}
                              </p>
                              <p className={cn(
                                'text-[10.5px] truncate mt-0.5',
                                item.isDuplicate ? 'text-amber-500/70' : 'text-zinc-600',
                              )}>
                                {item.error ?? item.url}
                              </p>
                            </div>
                            {/* ✅ Duplicate badge */}
                            {item.isDuplicate && (
                              <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-[10px] font-semibold text-amber-400">
                                duplicate
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 