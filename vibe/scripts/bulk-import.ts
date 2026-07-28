import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../api/_lib/firebaseAdmin.ts';
import { searchVideoIds, videoDetails, parseIsoDuration } from '../api/_lib/youtube.ts';
import { cleanTitle } from '../src/lib/cleanTitle.ts';

const MAX_TRACK_SECONDS = 12 * 60; // skip mixes/full albums/streams
const FIRESTORE_BATCH_LIMIT = 400;
const QUOTA_BUDGET = 9000; // stay under the 10,000/day free YouTube quota

// ── Broad one-time seed — several search angles per genre ──
const GENRE_QUERY_VARIANTS: Record<string, string[]> = {
  bollywood: [
    'top bollywood songs 2025', 'best bollywood songs 2024', 'bollywood hit songs 2023',
    'old bollywood hit songs', 'bollywood romantic songs', 'bollywood party songs',
    'bollywood love songs', 'trending bollywood songs',
  ],
  hiphop: [
    'top hip hop songs 2025', 'best rap songs 2024', 'hip hop hits 2023',
    'old school hip hop hits', 'trap hits', 'rap songs 2022',
    'underground hip hop hits', 'hip hop classics',
  ],
  pop: [
    'top pop songs 2025', 'best pop songs 2024', 'pop hits 2023',
    'pop classics', 'top 40 pop songs', 'pop songs 2022', 'viral pop songs',
  ],
  indie: [
    'best indie songs 2025', 'indie hits 2024', 'indie rock songs',
    'indie pop hits', 'indie folk songs', 'alternative indie hits',
  ],
  lofi: [
    'best lofi songs', 'lofi chill hits', 'lofi hip hop mix songs',
    'lofi study songs', 'chillhop songs',
  ],
  sufi: [
    'best sufi songs', 'sufi qawwali hits', 'sufi songs 2024', 'popular sufi tracks',
  ],
  classical: [
    'indian classical instrumental hits', 'best classical instrumental music',
    'carnatic classical music', 'hindustani classical music',
  ],
  edm: [
    'top edm songs 2025', 'best edm songs 2024', 'edm hits 2023',
    'electronic dance hits', 'festival edm anthems',
  ],
  rock: [
    'top rock songs 2025', 'best rock songs 2024', 'classic rock hits',
    'alternative rock hits', 'rock ballads', 'rock anthems',
  ],
  devotional: [
    'best devotional bhajan songs', 'popular hindu bhajans',
    'devotional songs hits', 'bhakti geet hits',
  ],
  punjabi: [
    'top punjabi songs 2025', 'best punjabi songs 2024', 'punjabi hits 2023',
    'punjabi bhangra hits', 'punjabi romantic songs',
  ],
  jazz: [
    'best jazz songs', 'jazz classics', 'smooth jazz hits', 'jazz standards',
  ],
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

  console.log('\n=== DONE ===');
  console.log('Added:', added);
  console.log('Skipped (too long/live/no duration):', skippedDuration);
  console.log('By genre:', byGenre);
  console.log('Approx YouTube quota used:', quotaUsed);
}

main().catch(err => { console.error(err); process.exit(1); });
