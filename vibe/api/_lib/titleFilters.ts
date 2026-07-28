// ── Reject compilation/clickbait-style titles ───────────────
// "Best Bollywood Songs 2024", "Nonstop Punjabi Hits", "Jukebox" etc. are
// multi-song promo videos, not a single original track — they slip past
// the duration filter often enough to be worth screening out by title too.
const COMPILATION_TITLE_PATTERNS = [
  /best\s+\S+\s+songs?\b/i,
  /best\s+of\s+20\d{2}/i,
  /top\s+\d+\s+songs?\b/i,
  /top\s+\S+\s+songs?\s+20\d{2}/i,
  /\bsongs?\s+of\s+20\d{2}\b/i,
  /\bhits?\s+20\d{2}\b/i,
  /20\d{2}\s+hits?\b/i,
  /non\s*-?\s*stop/i,
  /jukebox/i,
  /back\s*2?\s*back/i,
  /superhit\s+songs?/i,
  /songs?\s+collection/i,
  /\bmashup\b/i,
  /greatest\s+hits/i,
  /\b\d{2,}\s+songs?\b/i,
  /playlist\b/i,
  /new\s+songs?\s+20\d{2}/i,
];

export const isCompilationTitle = (title: string): boolean =>
  COMPILATION_TITLE_PATTERNS.some(p => p.test(title));
