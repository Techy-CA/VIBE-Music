import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin';
import { searchVideoIds, playlistVideoIds, videoDetails, parseIsoDuration } from './_lib/youtube';
import { GENRE_SEARCH_QUERIES } from './_lib/genreQueries';
import { CURATED_PLAYLISTS } from './_lib/curatedPlaylists';
import { cleanTitle } from '../src/lib/cleanTitle';

const RESULTS_PER_GENRE     = 8;   // trending videos pulled per genre per run
const MAX_TRACK_SECONDS     = 12 * 60; // skip mixes/full albums/streams
const FIRESTORE_BATCH_LIMIT = 400;

// ── Auto-ingest trending + curated YouTube tracks into the `songs` collection ──
// Triggered by Vercel Cron (see vercel.json) or manually via an authenticated POST.
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

    // 1. Collect candidate video IDs, each tagged with the genre(s) that surfaced it.
    const candidateGenres = new Map<string, Set<string>>();
    const addCandidate = (videoId: string, genreId: string) => {
      if (!candidateGenres.has(videoId)) candidateGenres.set(videoId, new Set());
      candidateGenres.get(videoId)!.add(genreId);
    };

    await Promise.all(
      Object.entries(GENRE_SEARCH_QUERIES).map(async ([genreId, query]) => {
        try {
          const ids = await searchVideoIds(apiKey, query, RESULTS_PER_GENRE);
          ids.forEach(id => addCandidate(id, genreId));
        } catch (err) {
          console.error(`[ingest-songs] search failed for genre "${genreId}":`, err);
        }
      }),
    );

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

    // 2. Drop anything already in the library.
    const existingSnap = await db.collection('songs').select('videoId').get();
    const existingIds  = new Set(existingSnap.docs.map(d => d.data().videoId as string));
    const newIds = [...candidateGenres.keys()].filter(id => !existingIds.has(id));

    if (newIds.length === 0) {
      res.status(200).json({ added: 0, message: 'No new songs found this run.' });
      return;
    }

    // 3. Fetch full details, filter out non-tracks, write to Firestore.
    const details = await videoDetails(apiKey, newIds);

    let batch       = db.batch();
    let opsInBatch  = 0;
    let added       = 0;
    const byGenre: Record<string, number> = {};

    for (const video of details) {
      const durationSec = parseIsoDuration(video.contentDetails.duration);
      if (durationSec === 0 || durationSec > MAX_TRACK_SECONDS) continue;

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

    res.status(200).json({ added, byGenre, scanned: newIds.length });
  } catch (err) {
    console.error('[ingest-songs] failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
