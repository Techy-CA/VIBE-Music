import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../api/_lib/firebaseAdmin.ts';
import { searchVideoIds, videoDetails, parseIsoDuration } from '../api/_lib/youtube.ts';
import { cleanTitle } from '../src/lib/cleanTitle.ts';
import { isCompilationTitle } from '../api/_lib/titleFilters.ts';
import { PRIORITY_ARTISTS } from '../api/_lib/priorityArtists.ts';

const MAX_TRACK_SECONDS = 12 * 60;
const FIRESTORE_BATCH_LIMIT = 400;
const RESULTS_PER_ARTIST = 50; // pulls deep into each artist's catalog, not just their top hit

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
  for (const { artist, genreId } of PRIORITY_ARTISTS) {
    try {
      const ids = await searchVideoIds(apiKey, artist, { maxResults: RESULTS_PER_ARTIST });
      quotaUsed += 100;
      ids.forEach(id => addCandidate(id, genreId));
      console.log(`[${artist}] -> ${ids.length} results (quota used: ${quotaUsed})`);
    } catch (err) {
      console.error(`  search failed for "${artist}":`, err instanceof Error ? err.message : err);
    }
  }

  const newIds = [...candidateGenres.keys()].filter(id => !existingIds.has(id));
  console.log(`\nTotal candidates: ${candidateGenres.size} | new: ${newIds.length}`);

  console.log('Fetching video details...');
  const details = await videoDetails(apiKey, newIds);

  let batch = db.batch();
  let opsInBatch = 0;
  let added = 0;
  let skippedDuration = 0;
  let skippedTitle = 0;

  for (const video of details) {
    const durationSec = parseIsoDuration(video.contentDetails.duration);
    if (durationSec === 0 || durationSec > MAX_TRACK_SECONDS) { skippedDuration++; continue; }
    if (isCompilationTitle(video.snippet.title)) { skippedTitle++; continue; }

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
    opsInBatch++;

    if (opsInBatch === FIRESTORE_BATCH_LIMIT) {
      await batch.commit();
      console.log(`  committed ${added} so far...`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) await batch.commit();

  console.log('\n=== DONE ===');
  console.log('Added:', added);
  console.log('Skipped (too long/live):', skippedDuration);
  console.log('Skipped (compilation title):', skippedTitle);
  console.log('Approx YouTube quota used:', quotaUsed);
}

main().catch(err => { console.error(err); process.exit(1); });
