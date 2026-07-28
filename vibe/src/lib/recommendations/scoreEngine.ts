import type { Song } from '../../types';
import type { UserTasteProfile } from '../../types';

export interface ScoredSong {
  song: Song;
  score: number;
  reason: 'content' | 'behavioral' | 'trending' | 'discovery';
}

const W = {
  genreMatch:   0.30,
  tagMatch:     0.20,
  liked:        0.25,
  skipPenalty: -0.40,
  trending:     0.10,
  discovery:    0.15,
};

export function scoreSong(
  candidate: Song,
  seedSong: Song,
  profile: UserTasteProfile,
  trendingIds: Set<string>,
): ScoredSong {
  let score = 0;
  let reason: ScoredSong['reason'] = 'content';

  // 1. Genre overlap with seed song
  const seedGenres   = new Set(seedSong.tags ?? []);
  const candGenres   = candidate.tags ?? [];
  const genreOverlap = candGenres.filter(t => seedGenres.has(t)).length;
  score += (genreOverlap / Math.max(seedGenres.size, 1)) * W.genreMatch;

  // 2. User genre affinity
  const genreBoost = candGenres.reduce((acc, tag) => {
    return acc + (profile.genreScores[tag] ?? 0);
  }, 0) / Math.max(candGenres.length, 1);
  score += genreBoost * W.tagMatch;

  // 3. Behavioral signals
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

  // 4. Trending boost
  if (trendingIds.has(candidate.id)) {
    score += W.trending;
    if (reason === 'content') reason = 'trending';
  }

  // 5. Discovery nudge
  const discoveryNudge = (Math.random() - 0.5) * profile.discoveryRate * 0.2;
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