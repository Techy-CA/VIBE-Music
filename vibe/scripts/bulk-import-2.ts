import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../api/_lib/firebaseAdmin.ts';
import { searchVideoIds, videoDetails, parseIsoDuration } from '../api/_lib/youtube.ts';
import { cleanTitle } from '../src/lib/cleanTitle.ts';

const MAX_TRACK_SECONDS = 12 * 60;
const FIRESTORE_BATCH_LIMIT = 400;
const QUOTA_BUDGET = 3000; // stay safely under today's remaining YouTube quota

// ── Round 2 — different angles (decades/moods/languages) so results don't
// just re-fetch what round 1 already pulled in ──
const GENRE_QUERY_VARIANTS: Record<string, string[]> = {
  lofi:       ['lofi sad songs', 'lofi sleep music songs', 'lofi jazz hop songs'],
  classical:  ['sitar instrumental music', 'flute instrumental relaxing music', 'violin instrumental hits'],
  jazz:       ['jazz piano songs', 'bossa nova jazz songs', 'jazz vocal classics'],
  edm:        ['edm 2010s hits', 'progressive house hits', 'edm workout songs'],
  devotional: ['krishna bhajan songs', 'shiv bhajan songs', 'gurbani shabad songs'],
  sufi:       ['sufi rock songs', 'coke studio sufi songs'],
  rock:       ['90s rock hits', '2000s rock hits', 'indie rock anthems'],
  pop:        ['2010s pop hits', '90s pop hits', 'k-pop hits'],
  hiphop:     ['2010s hip hop hits', 'desi hip hop songs', 'r&b hits'],
  bollywood:  ['bollywood sad songs', '90s bollywood songs', 'bollywood dance songs'],
  punjabi:    ['punjabi sad songs', 'punjabi rap songs'],
  indie:      ['indie acoustic songs', 'indie electronic songs'],
};

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set');

  const db = getAdminDb();

  console.log('Loading existing videoIds from Firestore...');
  const existingSnap = await db.collection('songs').select('videoId').get();
  const existingIds = new Set(existingSnap.docs.map(d => d.data().videoId as string));
  console.log(`Existing songs in library: ${existingIds.size}`);

  const candidateGenres = new Map<string, Set<string>>();
  const addCandidate = (videoId: string, genreId: string) => {
    if (!candidateGenres.has(videoId)) candidateGenres.set(videoId, new Set());
    candidateGenres.get(videoId)!.add(genreId);
  };

  let quotaUsed = 0;

  searchLoop:
  for (const [genreId, queries] of Object.entries(GENRE_QUERY_VARIANTS)) {
    for (const q of queries) {
      if (quotaUsed + 100 > QUOTA_BUDGET) break searchLoop;
      try {
        const ids = await searchVideoIds(apiKey, q, { maxResults: 50 });
        quotaUsed += 100;
        ids.forEach(id => addCandidate(id, genreId));
        console.log(`[${genreId}] "${q}" -> ${ids.length} results (quota used: ${quotaUsed})`);
      } catch (err) {
        console.error(`  search failed for "${q}":`, err instanceof Error ? err.message : err);
      }
    }
  }

  const newIds = [...candidateGenres.keys()].filter(id => !existingIds.has(id));
  console.log(`\nTotal candidates: ${candidateGenres.size} | new (not already in library): ${newIds.length}`);

  console.log('Fetching video details (duration/thumbnail)...');
  const details = await videoDetails(apiKey, newIds);

  let batch = db.batch();
  let opsInBatch = 0;
  let added = 0;
  let skippedDuration = 0;
  const byGenre: Record<string, number> = {};

  for (const video of details) {
    const durationSec = parseIsoDuration(video.contentDetails.duration);
    if (durationSec === 0 || durationSec > MAX_TRACK_SECONDS) { skippedDuration++; continue; }

    const genreIds = [...(candidateGenres.get(video.id) ?? [])];
    const thumbnail =
      video.snippet.thumbnails.high?.url
      ?? video.snippet.thumbnails.medium?.url
      ?? `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;

    const ref = db.collection('songs').doc();
    batch.set(ref, {
      title:       cleanTitle(video.snippet.title),
      youtubeUrl:  `https://www.youtube.com/watch?v=${video.id}`,
      videoId:     video.id,
      thumbnail,
      duration:    durationSec,
      addedBy:     'zuno-bot',
      addedByName: 'Zuno',
      likeCount:   0,
      tags:        genreIds,
      createdAt:   FieldValue.serverTimestamp(),
    });

    added++;
    genreIds.forEach(g => { byGenre[g] = (byGenre[g] ?? 0) + 1; });
    opsInBatch++;

    if (opsInBatch === FIRESTORE_BATCH_LIMIT) {
      await batch.commit();
      console.log(`  committed ${added} so far...`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  console.log('\n=== DONE (round 2) ===');
  console.log('Added:', added);
  console.log('Skipped (too long/live/no duration):', skippedDuration);
  console.log('By genre:', byGenre);
  console.log('Approx YouTube quota used:', quotaUsed);
}

main().catch(err => { console.error(err); process.exit(1); });
