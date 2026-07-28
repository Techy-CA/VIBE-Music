import type { Song } from '../../types';
import type { UserTasteProfile } from '../../types';

export interface ScoredSong {
  song: Song;
  score: number;
  reason: 'content' | 'behavioral' | 'trending' | 'discovery';
}

// Genre/tag overlap with the currently playing song is the one signal we can
// always trust — the taste-profile fields below only carry real weight once
// a user has enough behavioral history logged against them, so they're kept
// as a secondary boost rather than the primary driver.
const W = {
  genreMatch:      0.55,
  sameUploader:    0.08, // same person's uploads tend to share a vibe
  tagAffinity:     0.10,
  liked:           0.15,
  skipPenalty:    -0.60,
  trending:        0.06,
  discovery:       0.06,
};

export function scoreSong(
  candidate: Song,
  seedSong: Song,
  profile: UserTasteProfile,
  trendingIds: Set<string>,
): ScoredSong {
  let score = 0;
  let reason: ScoredSong['reason'] = 'content';

  // 1. Genre/tag overlap with the seed song — dominant signal
  const seedGenres   = new Set(seedSong.tags ?? []);
  const candGenres   = candidate.tags ?? [];
  const genreOverlap = candGenres.filter(t => seedGenres.has(t)).length;
  if (seedGenres.size > 0) {
    score += (genreOverlap / seedGenres.size) * W.genreMatch;
  } else {
    // Untagged seed — genre matching has nothing to work with, so lean on
    // trending/likes instead (boosted below) rather than scoring everything 0.
    score += (trendingIds.has(candidate.id) ? 1 : 0) * W.genreMatch * 0.5;
  }

  // 2. Same uploader as a light secondary signal
  if (candidate.addedBy && candidate.addedBy === seedSong.addedBy) {
    score += W.sameUploader;
  }

  // 3. User genre affinity (fills in once listen history exists)
  const genreBoost = candGenres.reduce((acc, tag) => {
    return acc + (profile.genreScores[tag] ?? 0);
  }, 0) / Math.max(candGenres.length, 1);
  score += genreBoost * W.tagAffinity;

  // 4. Behavioral signals
  if (profile.strongLikes.includes(candidate.id)) {
    score += W.liked * 1.0;
    reason = 'behavioral';
  } else if (profile.softLikes.includes(candidate.id)) {
    score += W.liked * 0.5;
    reason = 'behavioral';
  }

  if (profile.skipped.includes(candidate.id)) {
    score += W.skipPenalty;
  }

  if (profile.neverPlay.includes(candidate.id)) {
    return { song: candidate, score: -Infinity, reason };
  }

  // 5. Trending boost
  if (trendingIds.has(candidate.id)) {
    score += W.trending;
    if (reason === 'content' && genreOverlap === 0) reason = 'trending';
  }

  // 6. Small discovery nudge — variety among close scores, not a driver
  const discoveryNudge = (Math.random() - 0.5) * profile.discoveryRate * W.discovery;
  score += discoveryNudge;

  return { song: candidate, score, reason };
}

export function buildSmartQueue(
  seedSong: Song,
  candidates: Song[],
  profile: UserTasteProfile,
  trendingIds: Set<string>,
  size = 20,
): ScoredSong[] {
  return candidates
    .filter(s => s.id !== seedSong.id)
    .map(s => scoreSong(s, seedSong, profile, trendingIds))
    .filter(s => s.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, size);
}