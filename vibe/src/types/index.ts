export interface Song {
  duration: number;
  id: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  thumbnail: string;
  addedBy: string;
  addedByName: string;
  addedByPhoto?: string;
  likeCount: number;
  tags?: string[];
  createdAt: any;
}

export interface UserProfile {
  id: string;        // ✅ removed the broken uid() method signature
  uid?: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: any;
}

export interface Like {
  userId: string;
  songId: string;
  createdAt: any;
}

// ✅ Single clean Playlist interface — no duplicate
export interface Playlist {
  id:          string;
  name:        string;
  description: string;
  userId:      string;
  songIds:     string[];
  createdAt:   any;
  updatedAt:   any;
}

// ── Recommendation System Types ───────────────────────────
export interface ListenEvent {
  songId: string;
  startedAt: any;
  durationMs: number;
  songDurationMs: number;
  listenRatio: number;
  action: 'completed' | 'skipped' | 'repeated' | 'liked' | 'added_to_playlist';
  context: 'home' | 'playlist' | 'recommendation' | 'search';
  sessionId: string;
}

export interface UserTasteProfile {
  userId: string;
  genreScores: Record<string, number>;
  tagScores: Record<string, number>;
  strongLikes: string[];
  softLikes: string[];
  skipped: string[];
  neverPlay: string[];
  discoveryRate: number;
  updatedAt: any;
}

export const ADMIN_EMAIL = 'chinmayysugandhi@gmail.com';

export const GENRES = [
  { id: 'bollywood',  label: 'Bollywood',  emoji: '🎬' },
  { id: 'hiphop',     label: 'Hip Hop',    emoji: '🎤' },
  { id: 'pop',        label: 'Pop',        emoji: '🎵' },
  { id: 'indie',      label: 'Indie',      emoji: '🎸' },
  { id: 'lofi',       label: 'Lo-Fi',      emoji: '☕' },
  { id: 'sufi',       label: 'Sufi',       emoji: '🌙' },
  { id: 'classical',  label: 'Classical',  emoji: '🎻' },
  { id: 'edm',        label: 'EDM',        emoji: '⚡' },
  { id: 'rock',       label: 'Rock',       emoji: '🤘' },
  { id: 'devotional', label: 'Devotional', emoji: '🙏' },
  { id: 'punjabi',    label: 'Punjabi',    emoji: '🥁' },
  { id: 'jazz',       label: 'Jazz',       emoji: '🎷' },
] as const;

export type GenreId = typeof GENRES[number]['id'];