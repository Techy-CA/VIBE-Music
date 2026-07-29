import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyRequestAuth } from './_lib/firebaseAdmin';
import { searchVideoIds, videoDetails, parseIsoDuration } from './_lib/youtube';
import { isCompilationTitle } from './_lib/titleFilters';
import { cleanTitle } from '../src/lib/cleanTitle';

const MAX_RESULTS       = 12;
const MAX_TRACK_SECONDS = 15 * 60; // a bit more generous than auto-ingest — this is explicit user intent

// ── Live YouTube search, used only when the local library comes up short ──
// Auth-gated (a signed-in app user, not a public endpoint) because every
// call spends real YouTube quota (100 units) — this only fires when the
// user explicitly asks for it, never on every keystroke.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = await verifyRequestAuth(req.headers.authorization);
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'Missing query param "q"' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured' });
    return;
  }

  try {
    const ids = await searchVideoIds(apiKey, q, { maxResults: MAX_RESULTS });
    if (ids.length === 0) {
      res.status(200).json({ results: [] });
      return;
    }

    const details = await videoDetails(apiKey, ids);
    const results = details
      .filter(v => !isCompilationTitle(v.snippet.title))
      .map(v => {
        const durationSec = parseIsoDuration(v.contentDetails.duration);
        return { v, durationSec };
      })
      .filter(({ durationSec }) => durationSec > 0 && durationSec <= MAX_TRACK_SECONDS)
      .map(({ v, durationSec }) => ({
        videoId:    v.id,
        title:      cleanTitle(v.snippet.title),
        youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail:
          v.snippet.thumbnails.high?.url
          ?? v.snippet.thumbnails.medium?.url
          ?? `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
        duration: durationSec,
      }));

    res.status(200).json({ results });
  } catch (err) {
    console.error('[search-youtube] failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
