// ── Keywords to strip from YouTube video titles ────────────
const TITLE_STRIP_PATTERNS = [
  // Resolutions & quality
  /\b(4k|8k|hd|fhd|uhd|1080p|720p|480p|2160p)\b/gi,
  // Common suffixes
  /[([【]\s*(official\s*)?(music\s*)?video\s*[)\]】]/gi,
  /[([【]\s*(official\s*)?audio\s*[)\]】]/gi,
  /[([【]\s*(official\s*)?lyric(s)?\s*(video)?\s*[)\]】]/gi,
  /[([【]\s*full\s*(video|song|audio)?\s*[)\]】]/gi,
  /[([【]\s*(hd|hq|4k|8k)\s*[)\]】]/gi,
  /[([【][^\])】]*lyrics[^\])】]*[)\]】]/gi,
  // Inline keywords (with or without brackets)
  /\|\s*(official\s*)?(music\s*)?video/gi,
  /[-–|]\s*(official\s*)?(music\s*)?video/gi,
  /[-–|]\s*(official\s*)?audio/gi,
  /\b(official\s+music\s+video)\b/gi,
  /\b(official\s+video)\b/gi,
  /\b(official\s+audio)\b/gi,
  /\b(official\s+lyric(s)?\s*video)\b/gi,
  /\b(lyric(s)?\s*video)\b/gi,
  /\b(music\s+video)\b/gi,
  /\b(full\s+video)\b/gi,
  /\b(video\s+song)\b/gi,
  // Trailing separators
  /\s*[-–|:]\s*$/,
  // Extra whitespace
  /\s{2,}/g,
];

export const cleanTitle = (raw: string): string => {
  let title = raw;
  for (const pattern of TITLE_STRIP_PATTERNS) {
    title = title.replace(pattern, ' ');
  }
  return title.trim();
};
