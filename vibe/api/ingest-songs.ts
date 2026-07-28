import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin';
import { searchVideoIds, playlistVideoIds, videoDetails, parseIsoDuration } from './_lib/youtube';
import { GENRE_QUERY_POOL, GENRE_RECENCY_SEED } from './_lib/genreQueries';
import { CURATED_PLAYLISTS } from './_lib/curatedPlaylists';
import { PRIORITY_ARTISTS } from './_lib/priorityArtists';
import { cleanTitle } from '../src/lib/cleanTitle';
import { isCompilationTitle } from './_lib/titleFilters';

const MAX_TRACK_SECONDS     = 12 * 60; // skip mixes/full albums/streams
const FIRESTORE_BATCH_LIMIT = 400;
const RESULTS_PER_QUERY     = 50;      // YouTube's max per search call

// YouTube's free daily quota is 10,000 units; search.list costs 100 each.
// Budget stays under that so the run never 403s partway through.
const QUOTA_BUDGET       = 9200;
const RECENCY_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000; // last 3 days

// Flatten the per-genre query pool into a single rotating list.
const FLAT_POOL: { genreId: string; query: string }[] =
  Object.entries(GENRE_QUERY_POOL).flatMap(([genreId, queries]) =>
    queries.map(query => ({ genreId, query })),
  );

// Pick today's slice of the pool — wraps around so, over several days,
// every query in the pool eventually runs instead of just the first N forever.
function todaysPoolSlice(size: number): { genreId: string; query: string }[] {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const start = (dayIndex * size) % FLAT_POOL.length;
  const slice: { genreId: string; query: string }[] = [];
  for (let i = 0; i < size; i++) {
    slice.push(FLAT_POOL[(start + i) % FLAT_POOL.length]);
  }
  return slice;
}

// ── Auto-ingest trending + fresh + curated YouTube tracks into `songs` ──
// Triggered daily by Vercel Cron (see vercel.json) or manually via an
// authenticated request. Every run: (1) checks every genre for videos
// uploaded in the last few days — so new releases keep showing up even
// after the discovery pool below plateaus, then (2) burns the rest of the
// day's YouTube quota rotating through a large pool of genre search angles.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured' });
    return;
  }

  try {
    const db = getAdminDb();

    const candidateGenres = new Map<string, Set<string>>();
    const addCandidate = (videoId: string, genreId: string) => {
      if (!candidateGenres.has(videoId)) candidateGenres.set(videoId, new Set());
      candidateGenres.get(videoId)!.add(genreId);
    };

    let quotaUsed = 0;
    const searchesRun: string[] = [];

    // 1. Priority artists — always searched first, before anything else gets
    //    a shot at the quota budget.
    await Promise.all(
      PRIORITY_ARTISTS.map(async ({ artist, genreId }) => {
        try {
          const ids = await searchVideoIds(apiKey, artist, { maxResults: RESULTS_PER_QUERY });
          ids.forEach(id => addCandidate(id, genreId));
          searchesRun.push(`[artist:${genreId}] "${artist}" -> ${ids.length}`);
        } catch (err) {
          console.error(`[ingest-songs] priority artist search failed for "${artist}":`, err);
        }
      }),
    );
    quotaUsed += PRIORITY_ARTISTS.length * 100;

    // 2. Freshness pass — one recency-ordered query per genre, every run.
    const publishedAfter = new Date(Date.now() - RECENCY_LOOKBACK_MS).toISOString();
    await Promise.all(
      Object.entries(GENRE_RECENCY_SEED).map(async ([genreId, query]) => {
        try {
          const ids = await searchVideoIds(apiKey, query, {
            maxResults: RESULTS_PER_QUERY,
            order: 'date',
            publishedAfter,
          });
          ids.forEach(id => addCandidate(id, genreId));
          searchesRun.push(`[fresh:${genreId}] "${query}" -> ${ids.length}`);
        } catch (err) {
          console.error(`[ingest-songs] recency search failed for "${genreId}":`, err);
        }
      }),
    );
    quotaUsed += Object.keys(GENRE_RECENCY_SEED).length * 100;

    // 3. Discovery pass — rotate through the big query pool with whatever
    //    quota is left, so the whole pool cycles over multiple days.
    const remainingBudget = QUOTA_BUDGET - quotaUsed;
    const poolCallsToday  = Math.max(0, Math.floor(remainingBudget / 100));
    const todaysQueries   = todaysPoolSlice(poolCallsToday);

    for (const { genreId, query } of todaysQueries) {
      try {
        const ids = await searchVideoIds(apiKey, query, { maxResults: RESULTS_PER_QUERY });
        quotaUsed += 100;
        ids.forEach(id => addCandidate(id, genreId));
        searchesRun.push(`[pool:${genreId}] "${query}" -> ${ids.length}`);
      } catch (err) {
        console.error(`[ingest-songs] search failed for "${genreId}" / "${query}":`, err);
      }
    }

    // 4. Curated playlists, if configured — cheap regardless of size.
    await Promise.all(
      CURATED_PLAYLISTS.map(async ({ genreId, playlistId }) => {
        try {
          const ids = await playlistVideoIds(apiKey, playlistId);
          ids.forEach(id => addCandidate(id, genreId));
        } catch (err) {
          console.error(`[ingest-songs] playlist sync failed for "${playlistId}":`, err);
        }
      }),
    );

    // 5. Drop anything already in the library.
    const existingSnap = await db.collection('songs').select('videoId').get();
    const existingIds  = new Set(existingSnap.docs.map(d => d.data().videoId as string));
    const newIds = [...candidateGenres.keys()].filter(id => !existingIds.has(id));

    if (newIds.length === 0) {
      res.status(200).json({ added: 0, quotaUsed, searchesRun, message: 'No new songs found this run.' });
      return;
    }

    // 6. Fetch full details, filter out non-tracks and compilation-style
    //    titles ("Best Songs of 2024", "Nonstop Hits"), write to Firestore.
    const details = await videoDetails(apiKey, newIds);

    let batch        = db.batch();
    let opsInBatch   = 0;
    let added        = 0;
    let skippedTitle = 0;
    const byGenre: Record<string, number> = {};

    for (const video of details) {
      const durationSec = parseIsoDuration(video.contentDetails.duration);
      if (durationSec === 0 || durationSec > MAX_TRACK_SECONDS) continue;
      if (isCompilationTitle(video.snippet.title)) { skippedTitle++; continue; }

      const genreIds = [...(candidateGenres.get(video.id) ?? [])];
      const thumbnail =
        video.snippet.thumbnails.high?.url
        ?? video.snippet.thumbnails.medium?.url
        ?? `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;

      const ref = db.collection('songs').doc();
      batch.set(ref, {
        title:        cleanTitle(video.snippet.title),
        youtubeUrl:   `https://www.youtube.com/watch?v=${video.id}`,
        videoId:      video.id,
        thumbnail,
        duration:     durationSec,
        addedBy:      'zuno-bot',
        addedByName:  'Zuno',
        likeCount:    0,
        tags:         genreIds,
        createdAt:    FieldValue.serverTimestamp(),
      });

      added++;
      genreIds.forEach(g => { byGenre[g] = (byGenre[g] ?? 0) + 1; });
      opsInBatch++;

      if (opsInBatch === FIRESTORE_BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();

    res.status(200).json({ added, skippedTitle, byGenre, scanned: newIds.length, quotaUsed, searchesRun });
  } catch (err) {
    console.error('[ingest-songs] failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
